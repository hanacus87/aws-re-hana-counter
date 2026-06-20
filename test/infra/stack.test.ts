/**
 * CDK スタックの構成（synth アサーション）の仕様
 *
 * `aws-cdk-lib/assertions` の Template.fromStack で合成された CloudFormation を
 * 検証する（AWS への通信はしない）。ワイヤ上の挙動までは証明せず、構成の回帰を防ぐ。
 *
 * - DynamoDB は 2 テーブル。users は PK=sub、balances は PK=sub・SK=date、On-Demand。
 * - Lambda（Node.js）は handler=lambda.handler。テーブル名・設定・SSM パラメータ名・
 *   STATIC_DIR を環境変数で受け取り、両テーブル読み書きと SSM 取得の権限を持つ。
 *   シークレット値そのものは環境変数に載せない（SSM パラメータ名のみ）。
 * - Function URL は AWS_IAM、CloudFront からは OAC（lambda）で署名アクセスする。
 * - セキュリティヘッダーは CloudFront Response Headers Policy が唯一の真実源で、
 *   CSP は backend と同じ buildContentSecurityPolicy(false)。
 * - /api/*・/auth/* はキャッシュ無効で、Origin・Sec-Fetch-Site・Cookie を転送する。
 */
import { describe, expect, test } from "bun:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Code } from "aws-cdk-lib/aws-lambda";
import { buildContentSecurityPolicy } from "../../backend/lib/security";
import {
  GOOGLE_CLIENT_SECRET_PARAM,
  SESSION_SECRET_PARAM,
} from "../../infra/params";
import { AppStack } from "../../infra/stack";

const CACHING_DISABLED_ID = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";

function template(): Template {
  const app = new App();
  const stack = new AppStack(app, "TestStack", {
    env: { account: "111111111111", region: "ap-northeast-1" },
    lambdaCode: Code.fromInline("exports.handler = () => {};"),
    publicOrigin: "https://test.cloudfront.net",
    googleClientId: "client-id",
    googleRedirectUri: "https://test.cloudfront.net/auth/callback",
    sessionSecretParam: SESSION_SECRET_PARAM,
    googleClientSecretParam: GOOGLE_CLIENT_SECRET_PARAM,
  });
  return Template.fromStack(stack);
}

describe("DynamoDB テーブル", () => {
  test("テーブルは 2 つ（users・balances）", () => {
    template().resourceCountIs("AWS::DynamoDB::Table", 2);
  });

  test("いずれも On-Demand（PAY_PER_REQUEST）課金", () => {
    template().resourcePropertiesCountIs(
      "AWS::DynamoDB::Table",
      Match.objectLike({ BillingMode: "PAY_PER_REQUEST" }),
      2,
    );
  });

  test("users テーブルは PK=sub の単一キー", () => {
    template().hasResourceProperties(
      "AWS::DynamoDB::Table",
      Match.objectLike({
        KeySchema: [{ AttributeName: "sub", KeyType: "HASH" }],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: "sub", AttributeType: "S" },
        ]),
      }),
    );
  });

  test("balances テーブルは PK=sub・SK=date の複合キー", () => {
    template().hasResourceProperties(
      "AWS::DynamoDB::Table",
      Match.objectLike({
        KeySchema: [
          { AttributeName: "sub", KeyType: "HASH" },
          { AttributeName: "date", KeyType: "RANGE" },
        ],
      }),
    );
  });
});

describe("Lambda 関数", () => {
  test("Node.js ランタイムで handler=lambda.handler", () => {
    template().hasResourceProperties(
      "AWS::Lambda::Function",
      Match.objectLike({
        Runtime: Match.stringLikeRegexp("^nodejs"),
        Handler: "lambda.handler",
      }),
    );
  });

  test("環境変数にテーブル名・設定・SSM パラメータ名・STATIC_DIR を持つ", () => {
    template().hasResourceProperties(
      "AWS::Lambda::Function",
      Match.objectLike({
        Environment: {
          Variables: Match.objectLike({
            USERS_TABLE: Match.anyValue(),
            BALANCES_TABLE: Match.anyValue(),
            PUBLIC_ORIGIN: "https://test.cloudfront.net",
            GOOGLE_CLIENT_ID: "client-id",
            GOOGLE_REDIRECT_URI: "https://test.cloudfront.net/auth/callback",
            SESSION_SECRET_PARAM: SESSION_SECRET_PARAM,
            GOOGLE_CLIENT_SECRET_PARAM: GOOGLE_CLIENT_SECRET_PARAM,
            STATIC_DIR: "client",
          }),
        },
      }),
    );
  });

  test("環境変数のキーに生のシークレット名（_PARAM 無し）を持たない", () => {
    const functions = template().findResources("AWS::Lambda::Function");
    const variables = Object.values(functions)[0].Properties.Environment
      .Variables as Record<string, unknown>;
    const keys = Object.keys(variables);
    expect(keys).not.toContain("SESSION_SECRET");
    expect(keys).not.toContain("GOOGLE_CLIENT_SECRET");
    expect(keys).toContain("SESSION_SECRET_PARAM");
  });

  test("両テーブルへの読み書きと SSM パラメータ取得の権限を持つ", () => {
    template().hasResourceProperties(
      "AWS::IAM::Policy",
      Match.objectLike({
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(["dynamodb:Query", "dynamodb:PutItem"]),
            }),
            Match.objectLike({ Action: "ssm:GetParameter" }),
          ]),
        }),
      }),
    );
  });
});

describe("Function URL と OAC", () => {
  test("Function URL は AWS_IAM 認証", () => {
    template().hasResourceProperties(
      "AWS::Lambda::Url",
      Match.objectLike({ AuthType: "AWS_IAM" }),
    );
  });

  test("CloudFront からは OAC（lambda・SigV4・常時署名）でアクセスする", () => {
    template().hasResourceProperties(
      "AWS::CloudFront::OriginAccessControl",
      Match.objectLike({
        OriginAccessControlConfig: Match.objectLike({
          OriginAccessControlOriginType: "lambda",
          SigningBehavior: "always",
          SigningProtocol: "sigv4",
        }),
      }),
    );
  });

  test("Function URL に CORS を設定しない（OAC 経由の CloudFront のみ想定）", () => {
    template().hasResourceProperties(
      "AWS::Lambda::Url",
      Match.objectLike({ Cors: Match.absent() }),
    );
  });

  test("Dual Auth 対応：cloudfront に lambda:InvokeFunction も付与する（InvokeFunctionUrl だけだと 403）", () => {
    template().hasResourceProperties(
      "AWS::Lambda::Permission",
      Match.objectLike({
        Action: "lambda:InvokeFunction",
        Principal: "cloudfront.amazonaws.com",
        SourceArn: Match.anyValue(),
      }),
    );
  });
});

describe("Response Headers Policy（セキュリティヘッダーの真実源）", () => {
  test("本番 CSP（backend と同じ buildContentSecurityPolicy(false)）を設定する", () => {
    template().hasResourceProperties(
      "AWS::CloudFront::ResponseHeadersPolicy",
      Match.objectLike({
        ResponseHeadersPolicyConfig: Match.objectLike({
          SecurityHeadersConfig: Match.objectLike({
            ContentSecurityPolicy: Match.objectLike({
              ContentSecurityPolicy: buildContentSecurityPolicy(false),
              Override: true,
            }),
          }),
        }),
      }),
    );
  });

  test("frameOptions DENY・nosniff・referrer no-referrer・HSTS を設定する", () => {
    template().hasResourceProperties(
      "AWS::CloudFront::ResponseHeadersPolicy",
      Match.objectLike({
        ResponseHeadersPolicyConfig: Match.objectLike({
          SecurityHeadersConfig: Match.objectLike({
            FrameOptions: Match.objectLike({ FrameOption: "DENY" }),
            ContentTypeOptions: Match.objectLike({ Override: true }),
            ReferrerPolicy: Match.objectLike({ ReferrerPolicy: "no-referrer" }),
            StrictTransportSecurity: Match.objectLike({
              IncludeSubdomains: true,
              Preload: true,
            }),
          }),
        }),
      }),
    );
  });

  test("COOP・CORP・Permissions-Policy をカスタムヘッダーで設定する", () => {
    template().hasResourceProperties(
      "AWS::CloudFront::ResponseHeadersPolicy",
      Match.objectLike({
        ResponseHeadersPolicyConfig: Match.objectLike({
          CustomHeadersConfig: Match.objectLike({
            Items: Match.arrayWith([
              Match.objectLike({
                Header: "Cross-Origin-Opener-Policy",
                Value: "same-origin",
              }),
              Match.objectLike({
                Header: "Cross-Origin-Resource-Policy",
                Value: "same-origin",
              }),
              Match.objectLike({
                Header: "Permissions-Policy",
                Value: Match.stringLikeRegexp("camera="),
              }),
            ]),
          }),
        }),
      }),
    );
  });
});

describe("CloudFront ディストリビューションの振る舞い", () => {
  test("/api/* と /auth/* はキャッシュ無効（managed CachingDisabled）", () => {
    const distributions = template().findResources(
      "AWS::CloudFront::Distribution",
    );
    const config =
      Object.values(distributions)[0].Properties.DistributionConfig;
    const behaviors = config.CacheBehaviors as {
      PathPattern: string;
      CachePolicyId: string;
    }[];
    const paths = behaviors.map((b) => b.PathPattern);
    expect(paths).toContain("/api/*");
    expect(paths).toContain("/auth/*");
    for (const behavior of behaviors) {
      expect(behavior.CachePolicyId).toBe(CACHING_DISABLED_ID);
    }
  });

  test("変更系オリジンへ Origin・Sec-Fetch-Site・Cookie を転送する", () => {
    template().hasResourceProperties(
      "AWS::CloudFront::OriginRequestPolicy",
      Match.objectLike({
        OriginRequestPolicyConfig: Match.objectLike({
          HeadersConfig: Match.objectLike({
            HeaderBehavior: "whitelist",
            Headers: Match.arrayWith(["Origin", "Sec-Fetch-Site"]),
          }),
          CookiesConfig: Match.objectLike({ CookieBehavior: "all" }),
        }),
      }),
    );
  });
});

describe("デプロイ補助の出力", () => {
  test("CloudFront ドメインを出力する", () => {
    template().hasOutput(
      "DistributionDomainName",
      Match.objectLike({
        Value: { "Fn::GetAtt": Match.arrayWith(["DomainName"]) },
      }),
    );
  });

  test("Google に登録する callback URL を出力する", () => {
    template().hasOutput("AuthCallbackUrl", Match.objectLike({}));
  });
});
