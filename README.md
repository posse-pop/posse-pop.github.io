# POSSE POP v1.2.0

7列×6行・6種類のブロックで遊ぶ非公式ファンゲーム。
ENDLESSと60秒のPOSSE RUSH 60に対応します。

公開URL: https://posse-pop.github.io/

## 起動と確認

Node.js 22以上（推奨24）。依存パッケージのインストールは不要です。

```sh
npm test
npm start
```

プレビュー: http://127.0.0.1:4180/

```sh
npm run verify:site
```

公開された全配布ファイルとルートHTMLをローカルのSHA-256と照合します。

## 配布と更新

`dist/index.html` と `dist/sw.js` が入口で、現行実装は `dist/v1.2.0/`。
mainへのpush後、GitHub Actionsがテストを実行し、成功時だけ `dist/` を
GitHub Pagesのルートへ公開します。PagesのSourceはGitHub Actionsです。
テスト・ツール・この説明書は配布対象に含みません。

画像設定は `dist/v1.2.0/theme.js`。変更後に `npm run prepare` と `npm test` を実行。
更新時はapp.jsとsw.jsのVERSIONを同時に更新し、必要なら資産ディレクトリも版を上げてください。
相対URL、manifestのid/start_url/scope、Service Workerの登録先はルートを基準に解決します。
キャッシュは `posse-pop:<登録scope>:<VERSION>` に限定し、他のアプリのキャッシュを削除しません。

## Android / iPhone

- Android ChromeとiPhone Safariで公開URLを開き、縦・横表示とスワイプを確認。
- RUSHでタップ前は60秒を維持。カウント中にモード選択を開くと停止し、戻って再タップで再開。
- 両モードの得点、再読込後の保存、効果音を確認。
- 「オフライン準備完了」を確認後、機内モードで起動・プレイを確認。
- Androidはホーム画面へ追加。iPhoneはSafariの共有から「ホーム画面に追加」。
  インストールや全画面・向きの扱いはOS/ブラウザによって異なります。

保存記録はブラウザ・公開元ごとです。以前の公開元の記録は新しいURLへ自動移行しません。
このリポジトリには旧配布物、運用記録、認証情報を含めません。
提供された画像の権利は各権利者に帰属します。ソフトウェアや画像の再利用許諾は付与していません。
