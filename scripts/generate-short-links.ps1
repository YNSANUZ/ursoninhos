param(
  [switch]$OnlyMissing
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$templatePath = Join-Path $root 'produto-frase.html'
$template = Get-Content -LiteralPath $templatePath -Raw
$template = $template -replace '<meta name="viewport" content="width=device-width, initial-scale=1.0">', "<meta name=`"viewport`" content=`"width=device-width, initial-scale=1.0`">`r`n<base href=`"/`">"
$template = [regex]::Replace($template, '<title>.*?</title>', '<title>{{TITLE}}</title>', 'Singleline')
$template = [regex]::Replace($template, '<meta name="description" content=".*?">', '<meta name="description" content="{{DESCRIPTION}}">', 'Singleline')
$template = [regex]::Replace($template, '<meta name="keywords" content=".*?">', '<meta name="keywords" content="frases, desmotivacionais, camisas de frases, camiseta com frase, ursoninhos">', 'Singleline')
$metaBlock = @"
<link rel="canonical" href="{{CANONICAL}}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Ursoninhos">
<meta property="og:title" content="{{TITLE}}">
<meta property="og:description" content="{{DESCRIPTION}}">
<meta property="og:url" content="{{CANONICAL}}">
<meta property="og:image" content="{{IMAGE}}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{TITLE}}">
<meta name="twitter:description" content="{{DESCRIPTION}}">
<meta name="twitter:image" content="{{IMAGE}}">
"@
$template = $template -replace '<link rel="icon" type="image/webp" href="https://i\.ibb\.co/[^"]+">', "`$0`r`n$metaBlock"

$frasesPath = Join-Path $root 'assets\js\frases-data.js'
$frasesFile = Get-Content -LiteralPath $frasesPath
$frasesRaw = Get-Content -LiteralPath $frasesPath -Raw
$frasesLegadas = foreach ($line in $frasesFile) {
  if ($line -match "^\s*'(.+)'\,?\s*$") { $matches[1] }
}

$entradas = @()
for ($i = 0; $i -lt $frasesLegadas.Count; $i++) {
  $entradas += [pscustomobject]@{ shortId = 8500 + $i; phrase = $frasesLegadas[$i] }
}

$novas = [regex]::Matches($frasesRaw, "\{\s*shortId:\s*'(?<id>\d+)',\s*frase:\s*'(?<phrase>(?:\\'|[^'])*)'")
foreach ($match in $novas) {
  $entradas += [pscustomobject]@{
    shortId = [int]$match.Groups['id'].Value
    phrase = $match.Groups['phrase'].Value.Replace("\'", "'")
  }
}

function Escape-Html([string]$text) {
  return $text.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
}

foreach ($entrada in $entradas) {
  $phrase = $entrada.phrase
  $shortId = $entrada.shortId
  $shortPath = "/$shortId/"
  $title = "Camisa Preta - `"$phrase`" | Ursoninhos"
  $description = "Camisa preta com a frase `"$phrase`" por R$ 49,90. Veja a foto do produto, escolha o tamanho e compartilhe pelo WhatsApp."
  $imageUrl = "https://ursoninhos.com/assets/img/share/frases/$shortId.jpg"
  $canonical = "https://ursoninhos.com$shortPath"
  $html = $template.Replace('{{TITLE}}', (Escape-Html $title)).Replace('{{DESCRIPTION}}', (Escape-Html $description)).Replace('{{IMAGE}}', $imageUrl).Replace('{{CANONICAL}}', $canonical)
  $dir = Join-Path $root ([string]$shortId)
  $indexPath = Join-Path $dir 'index.html'
  if ($OnlyMissing -and (Test-Path -LiteralPath $indexPath)) { continue }
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Set-Content -LiteralPath $indexPath -Value $html -Encoding UTF8
}
Write-Host "Processados $($entradas.Count) links curtos de produtos."
