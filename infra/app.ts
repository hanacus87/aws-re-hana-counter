import { App } from "aws-cdk-lib";
import { Code } from "aws-cdk-lib/aws-lambda";
import { GOOGLE_CLIENT_SECRET_PARAM, SESSION_SECRET_PARAM } from "./params";
import { AppStack } from "./stack";

const app = new App();

new AppStack(app, "AwsReHanaCounter", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
  lambdaCode: Code.fromAsset("dist/lambda"),
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  sessionSecretParam: process.env.SESSION_SECRET_PARAM ?? SESSION_SECRET_PARAM,
  googleClientSecretParam:
    process.env.GOOGLE_CLIENT_SECRET_PARAM ?? GOOGLE_CLIENT_SECRET_PARAM,
});
