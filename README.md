# Bangumi X

## Worker secrets

MiniApp authentication reads the AppID from `server/wrangler.jsonc`. Configure the AppSecret
outside source control before local or remote authentication testing:

```sh
cd server
bunx wrangler secret put WECHAT_MINI_APP_SECRET
```
