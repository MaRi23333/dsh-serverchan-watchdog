import { MockAgent, setGlobalDispatcher } from 'undici'

// Tests must never inherit a real credential or route traffic through a user
// proxy. Delete by known name without reading or logging any original value.
for (const name of [
  'DSH_SERVERCHAN_SENDKEY',
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
]) {
  delete process.env[name]
}

const agent = new MockAgent()
agent.disableNetConnect()
setGlobalDispatcher(agent)
