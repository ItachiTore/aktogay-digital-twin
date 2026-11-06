# Генерирует по одному WAV на реплику русским голосом Windows.
# Запускать после установки русского голоса:
#   Параметры -> Время и язык -> Речь -> Управление голосами -> Добавить голоса -> Русский
param(
  [string]$Dir = $PSScriptRoot,
  [int]$Rate = 1
)

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$ru = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'ru*' } | Select-Object -First 1

if (-not $ru) {
  Write-Output 'NO_RU_VOICE'
  Write-Output 'Установленные голоса:'
  $synth.GetInstalledVoices() | ForEach-Object { '  ' + $_.VoiceInfo.Name + ' (' + $_.VoiceInfo.Culture.Name + ')' }
  exit 2
}

$synth.SelectVoice($ru.VoiceInfo.Name)
$synth.Rate = $Rate
Write-Output ('VOICE ' + $ru.VoiceInfo.Name)

$lines = Get-Content (Join-Path $Dir 'lines.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$i = 0
foreach ($l in $lines) {
  $i++
  $out = Join-Path $Dir ('cue{0:d2}.wav' -f $i)
  $synth.SetOutputToWaveFile($out)
  $synth.Speak($l.text)
  $synth.SetOutputToNull()
  $r = New-Object System.Media.SoundPlayer $out
  $r.Load()
  $len = [math]::Round(((Get-Item $out).Length - 44) / (16000.0 * 2), 2)
  $slot = if ($i -lt $lines.Count) { $lines[$i].at - $l.at } else { 14 }
  $flag = if ($len -gt $slot) { ' OVERRUN' } else { '' }
  Write-Output ('cue{0:d2} at {1}s len {2}s slot {3}s{4}' -f $i, $l.at, $len, $slot, $flag)
}
$synth.Dispose()
Write-Output 'DONE'
