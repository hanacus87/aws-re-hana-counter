# aws-re-hana-counter

モバイル向けカウンター Web アプリ。`re-hana-counter`（Cloudflare Workers + D1）を **AWS（CloudFront + Lambda Function URL + DynamoDB、IaC は AWS CDK）** へリプレイスしたもの。

- **仕様は `test/` 配下のテストが正**（説明は日本語）。要件文書がテストと矛盾する場合はテストに従う。
- 要件文書はユーザーがプロンプトで渡す。疑問が残る場合はユーザーに確認する。

## アーキテクチャ

- 配信は **CloudFront + リージョナル Lambda（Function URL / OAC・AWS_IAM）**。Lambda（Hono）が静的資産（`serveStatic`）・SPA フォールバック・API を全て握り、CloudFront がその応答をキャッシュする。
- 永続化は **DynamoDB**（`users`: PK=`sub` / `balances`: PK=`sub`・SK=`date`、On-Demand）。リージョンは **ap-northeast-1 単一**。
- ドメインは **CloudFront デフォルト（`*.cloudfront.net`）**。ACM 証明書・独自 DNS は使わない。
- IaC は **AWS CDK**（`infra/`）。Lambda は CDK `NodejsFunction`（esbuild）でバンドルする。

## コマンド

| コマンド                                           | 用途                                         |
| -------------------------------------------------- | -------------------------------------------- |
| `bun test`                                         | テスト実行                                   |
| `bun run dev`                                      | 開発サーバ (Vite + Hono)                     |
| `bun run build`                                    | 型チェック + 本番ビルド                      |
| `bun run typecheck`                                | 型チェックのみ（アプリ・サーバ・テスト全体） |
| `bun run lint` / `bun run format` / `bun run knip` | 品質チェック（lint・整形・未使用検出）       |
| `bun run cdk:synth` / `bun run cdk:diff`           | CDK 合成・差分                               |
| `bun run deploy` / `bun run destroy`               | デプロイ（build + `cdk deploy`）・破棄       |

コミット前に `bun test` / `bun run typecheck` / `bun run lint` / `bun run format:check` をすべて通す。

## TDD（必須）

実装より先にテストを書く。**いかなる実装コードも、それを検証するテストより先に書かない。**

1. **Red** — `test/` の該当 `test.todo()` をアサーション付きの実テストに起こし、`bun test` で失敗を確認する。
2. **Green** — テストを通す最小限の実装を書く。
3. **Refactor** — テストが通る状態を保ったまま整理する。

- テストのない振る舞いを実装に追加しない。仕様変更はまずテストへ反映する。
- テストが検証するのは**振る舞いのみ**。色・寸法・配置などのデザインはテストせず、CSS と目視で担保する。

## テストの書き方（テストは仕様書）

describe / test の名前と構造だけで仕様が読み取れるよう、日本語で記述する。

- テスト名は条件と期待結果を判定可能な形で書き、可能な限り具体値を併記する。
- テスト名は、そのアサーションが実際に検証する内容と一致させる（検証しない性質を主張しない）。
- 主観的・曖昧な語を使わない：「正しく」「適切に」「即座に」「一括で」等の副詞、「左」「右端」等の位置語。
- 名前・説明コメントにコード片（関数呼び出し・演算子・シグネチャ）を書かない。具体例は入力値と期待値を日本語の文で表す（検証対象を指す識別子・パス・値はそのまま書いてよい）。
- 配置はレイヤー別：`test/lib/`（純粋関数）・`test/backend/`（API・配信）・`test/ui/`（画面）・`test/infra/`（CDK synth アサーション）。
- `test/backend/` は永続化に**インメモリ Fake repository** を注入する。DynamoDB 実装（`@aws-sdk/lib-dynamodb` を叩く層）は `aws-sdk-client-mock` でコマンド構築を固定する。
- `test/infra/` は `aws-cdk-lib/assertions` の `Template.fromStack` で**構成**を固定する（AWS への通信は行わない）。ワイヤ上の挙動までは証明しない（合意済みの担保範囲）。

## 設計・コード構成

- **`frontend/` / `backend/` / `infra/` にコメントを書かない。** 意図は命名と関数分割で表現する（テストファイルは仕様書を兼ねるため例外）。
- ロジック（増減・下げ止まり・リセット・バリデーション・永続化）は UI から分離した純粋関数として `frontend/lib/` に置く。
- 副作用・非決定値は引数で注入する：localStorage は `Storage`（`test/lib/storage.test.ts` 参照）、現在時刻・乱数も引数で受け取る。
- **永続化は Repository ポート（`BalanceRepository` / `UserRepository`）を注入する。** 本番は DynamoDB 実装（`DynamoDBDocumentClient` を注入）、テストはインメモリ Fake。ルート層は具体実装でなくポートに依存する。
- state はそれを使用する最下層のコンポーネントに置く（`useState` / `useReducer` と props で持つ）。React Context は認証状態（ログインユーザー情報）の共有のみに使い、他用途への拡大はユーザーの事前承認を必須とする。
- カウンター構成の追加・削除・変更が `frontend/lib/state.ts` の `sections` 配列の変更のみで完結するようにする。

## 技術スタックの制約

- **フロントのランタイム依存は react / react-dom / hono / react-router のみ。** UI・CSS フレームワーク、アイコン集、状態管理、ユーティリティ（lodash 等）、日付・フォームライブラリは追加せず自前実装する。
- **サーバ実行時は AWS SDK（`@aws-sdk/client-dynamodb` / `@aws-sdk/lib-dynamodb` / `@aws-sdk/client-ssm`）を許可する。** これ以外のランタイム依存追加はユーザーの事前承認を必須とする。
- devDependencies は `@hono/vite-dev-server`（ローカルで Hono を Vite に同居）・`aws-cdk-lib` / `constructs` / `aws-cdk`（IaC）・`aws-sdk-client-mock`（テスト）を含む（承認済み）。これ以外の追加は事前承認必須。
- React Router は BrowserRouter / Routes / Route / Link のみ使用する。loader / action 等のデータ API は使わない。
- スタイルは素の CSS。色・寸法は CSS 変数で一元管理する。CSS-in-JS・プリプロセッサは使わない。
- 認証・JWT・Cookie は hono 組み込み機能で実装する。Auth SDK・ORM は追加しない。

## 性能・最小実装

- テストを通す最小限のコードのみ実装する。共通化・汎用化は、同じ処理が 2 箇所目で必要になった時点で導入する。
- `memo` / `useMemo` / `useCallback` は、計測で性能問題を確認した箇所にのみ使う。
- **アニメーションは最小限に保つ。** UI の状態遷移を滑らかにする短いトランジション・出現（エンター）のみ許可する：押下フィードバック、トグル・選択状態の変化、要素のマウント時の出現、フォーカス。`transform` / `opacity` を優先し、レイアウトに影響するプロパティのアニメーションは避ける。継続時間は約 200ms 以下とし、継続的・自動再生・注意喚起的な装飾モーションは使わない。`prefers-reduced-motion: reduce` で無効化する。継続時間・イージングは CSS 変数で一元管理する。
- 機能追加を伴わずにバンドルサイズを増やさない。配信物に画像を追加しない（favicon 用の `public/hana.svg` を除く）。マークは CSS（`clip-path` / `radial-gradient`）、装飾アイコンはインライン SVG で描く。Web フォントは自己ホスト（`public/` の woff2）に限り、外部 CDN からは読み込まない（CSP の `default-src 'self'` を維持する）。

## セキュリティ

認証・セッション・Cookie・外部サービス連携・データ保護などセキュリティに関わる設計は、実装前に敵対的評価（攻撃者視点の脆弱性レビュー）を行い、その結果をテストで固定してから着手する（OIDC に限らず適用する）。

- API がクライアントへ返すのは、画面表示・表示制御に必要な最小限のみ。内部識別子・トークン・シークレットを応答に含めない（DynamoDB の `ProjectionExpression` でも返却属性を絞る）。
- 保存・取得するユーザー情報は機能に必要な最小限に限定する（現状 `sub` と `userName` のみ。OIDC スコープも `openid profile` に限定）。
- ID トークンは OIDC Core の検証手順（署名・iss・aud・azp・exp・nonce）をすべて実施する。省略・簡略化しない。
- **シークレット（`SESSION_SECRET` / `GOOGLE_CLIENT_SECRET`）は SSM Parameter Store の SecureString で管理し、Lambda 環境変数・リポジトリ・CDK コードに平文で書かない。** Lambda 初期化時に取得しプロセス内にキャッシュする。
- **セキュリティヘッダーは CloudFront Response Headers Policy を唯一の真実源とする。** Lambda 側ではヘッダーを付与しない。CSP 等の値は純粋関数／定数で保持し、`test/infra/` の synth アサーションで CloudFront 構成と一致することを固定する（2 箇所ドリフトを防ぐ）。
- **CSRF の同一オリジン判定は設定値 `PUBLIC_ORIGIN` と比較する。** リクエスト URL のホストは CloudFront→Function URL で書き換わるため判定に使わない。CloudFront は `Origin` / `Sec-Fetch-Site` / `Cookie` を転送し、`Set-Cookie` を素通し、`/api/*`・`/auth/*` は CachingDisabled とする。
- Function URL は OAC（AWS_IAM）で CloudFront からのみ到達可能にする。
