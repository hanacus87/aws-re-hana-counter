import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { FunctionUrlOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  Code,
  Function as LambdaFunction,
  FunctionUrlAuthType,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { type Construct } from "constructs";
import { buildContentSecurityPolicy } from "../backend/lib/security";

export interface AppStackProps extends StackProps {
  lambdaCode: Code;
  publicOrigin: string;
  googleClientId: string;
  googleRedirectUri: string;
  sessionSecretParam: string;
  googleClientSecretParam: string;
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const usersTable = new Table(this, "UsersTable", {
      partitionKey: { name: "sub", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const balancesTable = new Table(this, "BalancesTable", {
      partitionKey: { name: "sub", type: AttributeType.STRING },
      sortKey: { name: "date", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const apiFunction = new LambdaFunction(this, "ApiFunction", {
      runtime: Runtime.NODEJS_20_X,
      handler: "lambda.handler",
      code: props.lambdaCode,
      environment: {
        USERS_TABLE: usersTable.tableName,
        BALANCES_TABLE: balancesTable.tableName,
        PUBLIC_ORIGIN: props.publicOrigin,
        GOOGLE_CLIENT_ID: props.googleClientId,
        GOOGLE_REDIRECT_URI: props.googleRedirectUri,
        SESSION_SECRET_PARAM: props.sessionSecretParam,
        GOOGLE_CLIENT_SECRET_PARAM: props.googleClientSecretParam,
        STATIC_DIR: "client",
      },
    });

    usersTable.grantReadWriteData(apiFunction);
    balancesTable.grantReadWriteData(apiFunction);

    const secretParameterArn = (name: string) =>
      this.formatArn({
        service: "ssm",
        resource: "parameter",
        resourceName: name.replace(/^\//, ""),
      });
    apiFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          secretParameterArn(props.sessionSecretParam),
          secretParameterArn(props.googleClientSecretParam),
        ],
      }),
    );

    const functionUrl = apiFunction.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
    });
    const origin = FunctionUrlOrigin.withOriginAccessControl(functionUrl);

    const responseHeadersPolicy = new ResponseHeadersPolicy(
      this,
      "SecurityHeaders",
      {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: buildContentSecurityPolicy(false),
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: Duration.seconds(63072000),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: HeadersReferrerPolicy.NO_REFERRER,
            override: true,
          },
        },
        customHeadersBehavior: {
          customHeaders: [
            {
              header: "Cross-Origin-Opener-Policy",
              value: "same-origin",
              override: true,
            },
            {
              header: "Cross-Origin-Resource-Policy",
              value: "same-origin",
              override: true,
            },
            {
              header: "Permissions-Policy",
              value: "camera=(), microphone=(), geolocation=()",
              override: true,
            },
          ],
        },
      },
    );

    const dynamicOriginRequestPolicy = new OriginRequestPolicy(
      this,
      "DynamicOriginRequestPolicy",
      {
        headerBehavior: OriginRequestHeaderBehavior.allowList(
          "Origin",
          "Sec-Fetch-Site",
        ),
        cookieBehavior: OriginRequestCookieBehavior.all(),
        queryStringBehavior: OriginRequestQueryStringBehavior.all(),
      },
    );

    const dynamicBehavior = {
      origin,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: AllowedMethods.ALLOW_ALL,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      originRequestPolicy: dynamicOriginRequestPolicy,
      responseHeadersPolicy,
    };

    const distribution = new Distribution(this, "Cdn", {
      comment: "aws-re-hana-counter",
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy,
      },
      additionalBehaviors: {
        "/api/*": dynamicBehavior,
        "/auth/*": dynamicBehavior,
      },
    });

    apiFunction.addPermission("CloudFrontInvokeFunction", {
      principal: new ServicePrincipal("cloudfront.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
    });

    new CfnOutput(this, "DistributionDomainName", {
      value: distribution.distributionDomainName,
    });
    new CfnOutput(this, "AuthCallbackUrl", {
      value: `https://${distribution.distributionDomainName}/auth/callback`,
    });
  }
}
