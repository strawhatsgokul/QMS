param(
  [string]$ApiUrl = "http://localhost:4000",
  [string]$AgentKey = "test-agent-key-2026",
  [string]$Hostname = $env:COMPUTERNAME,
  [int]$HeartbeatInterval = 5
)

$ErrorActionPreference = "Stop"
$script:token = $null
$script:agentId = $null

function Write-Log($msg) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$timestamp] $msg"
}

function Invoke-Api($method, $path, $body, $useAuth) {
  $params = @{
    Method = $method
    Uri = "$ApiUrl$path"
    ContentType = "application/json"
  }
  if ($body) { $params.Body = ($body | ConvertTo-Json) }
  $headers = @{}
  if ($useAuth -and $script:token) {
    $headers["Authorization"] = "Bearer $($script:token)"
  }
  if ($headers.Count -gt 0) { $params.Headers = $headers }

  try {
    $response = Invoke-RestMethod @params
    return $response
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $body = $_.ErrorDetails.Message
    Write-Log "ERROR [$statusCode] $path : $body"
    return $null
  }
}

# Phase 1: Register
Write-Log "=== Mock Agent Starting ==="
Write-Log "API: $ApiUrl | Hostname: $Hostname"

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -ne "Loopback Pseudo-Interface 1" } | Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "127.0.0.1" }

$registerBody = @{
  hostname  = $Hostname
  ipAddress = $ip
  macAddress = (Get-NetAdapter | Select-Object -First 1).MacAddress
  os        = "$((Get-CimInstance Win32_OperatingSystem).Caption) $((Get-CimInstance Win32_OperatingSystem).Version)"
  version   = "1.0.0-mock"
  agentKey  = $AgentKey
}

Write-Log "Registering agent..."
$regResult = Invoke-Api "POST" "/api/v1/agent/register" $registerBody $false

if (-not $regResult -or -not $regResult.success) {
  Write-Log "FATAL: Registration failed"
  exit 1
}

$script:token = $regResult.data.token
$script:agentId = $regResult.data.agentId
Write-Log "Registered! AgentId: $script:agentId"
Write-Log "Token: $($script:token.Substring(0, 20))..."

# Phase 2: Heartbeat loop
Write-Log "Starting heartbeat loop (every ${HeartbeatInterval}s)..."
$count = 0

do {
  $count++
  $cpu = [math]::Round((Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average, 1)
  $osInfo = Get-CimInstance Win32_OperatingSystem
  $memUsed = [math]::Round(($osInfo.TotalVisibleMemorySize - $osInfo.FreePhysicalMemory) * 1024)
  $memTotal = [math]::Round($osInfo.TotalVisibleMemorySize * 1024)
  $memPercent = [math]::Round(($memUsed / $memTotal) * 100, 1)

  $topProcesses = (Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, CPU, WorkingSet | ConvertTo-Json -Compress)

  $heartbeat = @{
    cpuUsage        = $cpu
    memoryUsage     = $memPercent
    memoryTotal     = $memTotal
    topProcesses    = $topProcesses
    activeWindow    = (Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1).MainWindowTitle
    activitySummary = "{}"
    veyonStatus     = "online"
    awStatus        = "offline"
  }

  $hbResult = Invoke-Api "POST" "/api/v1/agent/heartbeat" $heartbeat $true
  if ($hbResult -and $hbResult.success) {
    $pendingMsg = if ($hbResult.data.commandsPending -gt 0) { " ($($hbResult.data.commandsPending) PENDING)" } else { "" }
    Write-Log "Heartbeat #$count OK - CPU:${cpu}% MEM:${memPercent}%${pendingMsg}"
  } else {
    Write-Log "Heartbeat #$count FAILED"
  }

  # Check for pending commands
  $cmdsResult = Invoke-Api "GET" "/api/v1/agent/commands" $null $true
  if ($cmdsResult -and $cmdsResult.success -and $cmdsResult.data.Count -gt 0) {
    foreach ($cmd in $cmdsResult.data) {
      Write-Log "COMMAND RECEIVED: $($cmd.type) | Id: $($cmd.id)"
      $cmdResult = @{
        status = "completed"
        result = "Mock execution of $($cmd.type) succeeded"
      }
      $reportResult = Invoke-Api "POST" "/api/v1/agent/commands/$($cmd.id)/result" $cmdResult $true
      if ($reportResult -and $reportResult.success) {
        Write-Log "COMMAND $($cmd.id) result reported"
      }
    }
  }

  # Fetch config every 10 heartbeats
  if ($count % 10 -eq 0) {
    $configResult = Invoke-Api "GET" "/api/v1/agent/config" $null $true
    if ($configResult -and $configResult.success) {
      Write-Log "CONFIG: heartbeatInterval=$($configResult.data.heartbeatInterval)s commandPoll=$($configResult.data.commandPollInterval)s"
    }
  }

  Start-Sleep -Seconds $HeartbeatInterval
} while ($true)
