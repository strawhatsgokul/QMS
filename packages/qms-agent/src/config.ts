export interface AgentConfig {
  apiUrl: string;
  agentKey: string;
  useHttps: boolean;
  certPath?: string;
  heartbeatInterval: number;
  commandPollInterval: number;
  dataDir: string;
  veyonWebapiUrl: string;
  veyonApiKey: string;
}

function getDataDir(): string {
  const programData = process.env['PROGRAMDATA'];
  if (programData) return `${programData}\\QMS\\agent`;
  if (process.env['HOME']) return `${process.env['HOME']}/.qms/agent`;
  return './data';
}

export function loadConfig(): AgentConfig {
  const args = process.argv.slice(2);
  const getArg = (flag: string, defaultValue: string): string => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1]!;
    return defaultValue;
  };
  const hasFlag = (flag: string): boolean => args.includes(flag);

  return {
    apiUrl: getArg('--api-url', process.env['AGENT_API_URL'] || 'http://localhost:4000'),
    agentKey: getArg('--agent-key', process.env['AGENT_KEY'] || 'test-agent-key-2026'),
    useHttps: hasFlag('--use-https') || process.env['AGENT_USE_HTTPS'] === 'true',
    certPath: getArg('--cert-path', process.env['AGENT_CERT_PATH'] || ''),
    heartbeatInterval: parseInt(getArg('--heartbeat-interval', process.env['AGENT_HEARTBEAT_INTERVAL'] || '30'), 10),
    commandPollInterval: parseInt(getArg('--command-poll-interval', process.env['AGENT_COMMAND_POLL_INTERVAL'] || '5'), 10),
    dataDir: getArg('--data-dir', getDataDir()),
    veyonWebapiUrl: getArg('--veyon-webapi-url', process.env['AGENT_VEYON_WEBAPI_URL'] || 'http://localhost:11080/api/v1'),
    veyonApiKey: getArg('--veyon-api-key', process.env['AGENT_VEYON_API_KEY'] || ''),
  };
}
