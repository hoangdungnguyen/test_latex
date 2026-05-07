/**
 * Automatic Tool Test Script for Bonsai + Local Models
 * 
 * Tests each tool by:
 * 1. Sending a prompt to Bonsai
 * 2. Detecting tool calls in the response
 * 3. Executing the tool calls
 * 4. Verifying results
 * 
 * Run: node test-auto-tools.mjs
 */

import http from 'http'
import { execSync } from 'child_process'
import fs from 'fs'

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

// ============================================
// parseTextToolCalls - Copy from bash.ts
// ============================================

function parseTextToolCalls(text) {
  const toolCalls = []

  // Pattern 1: TOOL: name\nCOMMAND: command\nEND
  const toolPattern1 = /TOOL:\s*(\w+)\s*\nCOMMAND:\s*([^\n]+)\s*\nEND/gi
  let match
  while ((match = toolPattern1.exec(text)) !== null) {
    const toolName = match[1].toLowerCase()
    const command = match[2].trim()
    toolCalls.push({
      name: toolName,
      arguments: toolName === 'bash' ? { command } : { input: command },
      raw: match[0]
    })
  }

  // Pattern 2: JSON
  const jsonPattern = /```json\s*\n([\s\S]*?)\n```/gi
  while ((match = jsonPattern.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.name) {
        toolCalls.push({
          name: parsed.name.toLowerCase(),
          arguments: parsed.arguments || parsed.params || {},
          raw: match[0]
        })
      }
    } catch {}
  }

  // Pattern 3: bash("command") or bash `command`
  const bashPattern = /bash\s*\(\s*`([^`]+)`\s*\)|bash\s*\(\s*"([^"]+)"\s*\)/gi
  while ((match = bashPattern.exec(text)) !== null) {
    const command = match[1] || match[2]
    if (command) {
      toolCalls.push({
        name: 'bash',
        arguments: { command: command.trim() },
        raw: match[0]
      })
    }
  }

  return toolCalls
}

function containsToolCall(text) {
  const patterns = [
    /TOOL:\s*\w+/i,
    /<tool_call/i,
    /```json\s*\n\s*\{/,
    /bash\s*\(/,
  ]
  return patterns.some(p => p.test(text))
}

// Config
const BONSAI_CONFIG = {
  baseURL: 'http://127.0.0.1:8082/v1',
  model: 'prism-ml_Bonsai-8B-gguf_Bonsai-8B.gguf',
  apiKey: 'ollama'
}

const TEST_DIR = '/Users/hoangdungnguyen/Documents/Side projects/Latex tool/test'

// Test cases
const TEST_CASES = [
  {
    name: 'ls - List Files',
    prompt: 'List all files in the current directory using the ls tool.',
    system: `You have access to tools. Use this EXACT format:
TOOL: ls
COMMAND: .
END`,
    expectedTool: 'ls',
    checkFn: (result) => result.includes('.tex') || result.includes('main')
  },
  {
    name: 'bash - echo',
    prompt: 'Run: echo "Hello from Bonsai"',
    system: `You have access to tools. Use this EXACT format:
TOOL: bash
COMMAND: echo "Hello from Bonsai"
END`,
    expectedTool: 'bash',
    checkFn: (result) => result.includes('Hello from Bonsai')
  },
  {
    name: 'bash - ls -la',
    prompt: 'List all files with details using: ls -la',
    system: `You have access to tools. Use this EXACT format:
TOOL: bash
COMMAND: ls -la
END`,
    expectedTool: 'bash',
    checkFn: (result) => result.includes('.tex') || result.includes('total')
  },
  {
    name: 'bash - pwd',
    prompt: 'Show the current working directory using pwd.',
    system: `You have access to tools. Use this EXACT format:
TOOL: bash
COMMAND: pwd
END`,
    expectedTool: 'bash',
    checkFn: (result) => result.includes('Latex tool') || result.includes('/')
  },
  {
    name: 'bash - wc -l',
    prompt: 'Count the number of lines in main.tex using wc -l.',
    system: `You have access to tools. Use this EXACT format:
TOOL: bash
COMMAND: wc -l main.tex
END`,
    expectedTool: 'bash',
    checkFn: (result) => /\d+/.test(result)
  },
  {
    name: 'bash - ls *.tex',
    prompt: 'List only .tex files using: ls *.tex',
    system: `You have access to tools. Use this EXACT format:
TOOL: bash
COMMAND: ls *.tex
END`,
    expectedTool: 'bash',
    checkFn: (result) => result.includes('.tex')
  }
]

// ============================================
// HTTP Request to Bonsai
// ============================================

function callBonsai(messages, maxTokens = 200) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: BONSAI_CONFIG.model,
      messages,
      stream: false,
      max_tokens: maxTokens
    })

    const options = {
      hostname: '127.0.0.1',
      port: 8082,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${BONSAI_CONFIG.apiKey}`
      }
    }

    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          resolve(parsed)
        } catch (e) {
          reject(new Error('Parse error: ' + body))
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Request timeout (30s)'))
    })
    
    req.write(data)
    req.end()
  })
}

// ============================================
// Execute Tool
// ============================================

function executeToolParsed(toolName, args) {
  try {
    switch (toolName) {
      case 'bash':
        const cmd = args.command || args[0]
        if (!cmd) return { error: 'No command provided', output: '' }
        const output = execSync(cmd, { 
          cwd: TEST_DIR, 
          encoding: 'utf-8', 
          timeout: 5000 
        })
        return { error: null, output: output.trim() }
      
      case 'ls':
        const path = args.path || args[0] || '.'
        const lsOutput = execSync(`ls ${path}`, { 
          cwd: TEST_DIR, 
          encoding: 'utf-8', 
          timeout: 5000 
        })
        return { error: null, output: lsOutput.trim() }
      
      default:
        return { error: `Unknown tool: ${toolName}`, output: '' }
    }
  } catch (e) {
    return { error: e.message, output: '' }
  }
}

// ============================================
// Run Single Test
// ============================================

async function runTest(tc) {
  process.stdout.write(`\n${c.cyan}Testing: ${tc.name}...${c.reset}\n`)

  try {
    // Call Bonsai
    const response = await callBonsai([
      { role: 'system', content: tc.system },
      { role: 'user', content: tc.prompt }
    ])

    const content = response.choices?.[0]?.message?.content || ''
    
    // Check for text-based tool calls
    const hasToolCall = containsToolCall(content)
    
    if (!hasToolCall) {
      console.log(`${c.red}✗ FAILED: No tool call detected${c.reset}`)
      console.log(`  Response: ${content.substring(0, 200)}...`)
      return { name: tc.name, passed: false, reason: 'No tool call' }
    }

    // Parse tool calls
    const parsed = parseTextToolCalls(content)
    
    if (parsed.length === 0) {
      console.log(`${c.red}✗ FAILED: Could not parse tool call${c.reset}`)
      console.log(`  Response: ${content.substring(0, 200)}...`)
      return { name: tc.name, passed: false, reason: 'Parse failed' }
    }

    const toolCall = parsed[0]
    console.log(`  ${c.magenta}Tool:${c.reset} ${toolCall.name}`)
    console.log(`  ${c.magenta}Args:${c.reset} ${JSON.stringify(toolCall.arguments)}`)

    // Execute tool
    const result = executeToolParsed(toolCall.name, toolCall.arguments)
    
    if (result.error) {
      console.log(`  ${c.red}Tool Error:${c.reset} ${result.error}`)
      return { name: tc.name, passed: false, reason: result.error }
    }

    console.log(`  ${c.green}Output:${c.reset} ${result.output.substring(0, 100)}...`)

    // Check result
    const passed = tc.checkFn(result.output)
    
    if (passed) {
      console.log(`${c.green}✓ PASSED${c.reset}`)
      return { name: tc.name, passed: true }
    } else {
      console.log(`${c.red}✗ FAILED: Check failed${c.reset}`)
      return { name: tc.name, passed: false, reason: 'Check failed' }
    }

  } catch (e) {
    console.log(`${c.red}✗ ERROR: ${e.message}${c.reset}`)
    return { name: tc.name, passed: false, reason: e.message }
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log(`\n${c.bright}${c.cyan}╔══════════════════════════════════════════════════════════╗${c.reset}`)
  console.log(`${c.bright}${c.cyan}║     BONSAI + TOOLS AUTOMATIC TEST                      ║${c.reset}`)
  console.log(`${c.bright}${c.cyan}╚══════════════════════════════════════════════════════════╝${c.reset}\n`)

  // Check connection
  console.log(`${c.yellow}Checking Bonsai connection...${c.reset}`)
  try {
    await callBonsai([{ role: 'user', content: 'hi' }], 10)
    console.log(`${c.green}✓ Connected to Bonsai${c.reset}\n`)
  } catch (e) {
    console.log(`${c.red}✗ Cannot connect to Bonsai: ${e.message}${c.reset}`)
    console.log(`  Make sure Bonsai is running at ${BONSAI_CONFIG.baseURL}`)
    process.exit(1)
  }

  // Run tests
  const results = []
  
  for (const tc of TEST_CASES) {
    const result = await runTest(tc)
    results.push(result)
  }

  // Summary
  console.log(`\n${c.bright}${c.cyan}═══════════════════════════════════════════════════════════${c.reset}`)
  console.log(`${c.bright}SUMMARY${c.reset}`)
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════${c.reset}\n`)

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  for (const r of results) {
    const icon = r.passed ? `${c.green}✓` : `${c.red}✗`
    const status = r.passed ? 'PASSED' : `FAILED: ${r.reason}`
    console.log(`${icon} ${r.name}: ${status}${c.reset}`)
  }

  console.log(`\n${c.bright}Total: ${passed}/${results.length} passed${c.reset}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(console.error)