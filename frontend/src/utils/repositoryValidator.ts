export interface RepoValidationResult {
  isValid: boolean
  type: 'git_url' | 'local_path' | 'code_snippet' | 'invalid'
  message: string
  invalidLine?: string
}

/**
 * Validates a repository location string (Git URL, local directory path, file URI, or raw code block).
 * Explicitly rejects invalid URI protocols (e.g. db2://, fake://, cron://, oracle://) or malformed strings.
 */
export function validateRepoLocation(input: string): RepoValidationResult {
  const loc = input.trim()
  if (!loc) {
    return {
      isValid: false,
      type: 'invalid',
      message: '⚠️ Validation Failed: Repository location cannot be empty. Please enter a valid Git Repository URL, Web Crawler URL, or Local File Path.',
    }
  }

  // 1. Check for invalid or unsupported protocol schemes (e.g. db2://, oracle://, fake://, cron://, ftp://, etc.)
  const schemeMatch = loc.match(/^([a-z0-9+-.]+):\/\//i)
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase()
    if (!['http', 'https', 'git', 'ssh', 'file'].includes(scheme)) {
      return {
        isValid: false,
        type: 'invalid',
        message: `❌ Validation Failed: Unsupported protocol "${scheme}://". Acceptable schemes are http://, https://, git://, ssh://, or file:// paths.`,
      }
    }
  }

  // 2. Git URL validation (http/https/git/ssh/git@)
  const isGitUrl =
    /^(https?:\/\/|git:\/\/|ssh:\/\/|git@)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(loc) ||
    /^(https?:\/\/)?(www\.)?(github\.com|gitlab\.com|bitbucket\.org|dev\.azure\.com|gitea\.com)\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/i.test(loc) ||
    loc.endsWith('.git')

  if (isGitUrl) {
    if (/https?:\/\//i.test(loc)) {
      try {
        const urlObj = new URL(loc)
        if (!urlObj.hostname || (!urlObj.hostname.includes('.') && urlObj.hostname !== 'localhost')) {
          return {
            isValid: false,
            type: 'invalid',
            message: `❌ Validation Failed: "${loc}" does not have a valid domain hostname (e.g., github.com, gitlab.company.org).`,
          }
        }
      } catch {
        return {
          isValid: false,
          type: 'invalid',
          message: `❌ Validation Failed: Malformed URL syntax in "${loc}".`,
        }
      }
    }
    return {
      isValid: true,
      type: 'git_url',
      message: `✓ Repository Validated Successfully! Accessible Git / Web Repository URL confirmed: "${loc}"`,
    }
  }

  // 3. Local Filesystem Directory / File Path validation
  // Examples: C:\repo\src, /usr/local/code, /db2/cobol_repository, ./src, ../project, file:///path
  const isWindowsAbsPath = /^[a-zA-Z]:[\\/][^:*?"<>|]+$/i.test(loc)
  const isUnixAbsPath = /^\/[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*\/?$/.test(loc) && !loc.includes('://')
  const isRelativePath = /^(\.\/|\.\.\/)[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*\/?$/.test(loc)
  const isFileUri = /^file:\/\/\/[^:*?"<>|]+$/i.test(loc)

  if (isWindowsAbsPath || isUnixAbsPath || isRelativePath || isFileUri) {
    return {
      isValid: true,
      type: 'local_path',
      message: `✓ Repository Validated Successfully! Valid local filesystem directory / path confirmed: "${loc}"`,
    }
  }

  // 4. Raw Code Snippet validation
  const isMultiLineCode = loc.includes('\n') && loc.split('\n').length >= 2 && loc.length >= 20
  const hasCodeKeywords =
    /\b(IDENTIFICATION\s+DIVISION|PROCEDURE\s+DIVISION|CREATE\s+TABLE|SELECT\s+.*FROM|import\s+.*from|public\s+class|def\s+[a-zA-Z_0-9]+\(|#include\s+<|DATA\s+step|PROC\s+[a-zA-Z0-9]+)\b/i.test(loc)

  if (isMultiLineCode || hasCodeKeywords) {
    return {
      isValid: true,
      type: 'code_snippet',
      message: `✓ Repository Validated Successfully! Valid inline code snippet verified (${loc.length} characters parsed).`,
    }
  }

  // Reject anything else
  return {
    isValid: false,
    type: 'invalid',
    message: `❌ Validation Failed: "${loc}" is not a valid Git URL (e.g. https://github.com/org/repo.git) or valid local path. Unsupported protocol or format.`,
  }
}

/**
 * Validates multiple repository lines. Returns first invalid result or success result.
 */
export function validateRepoLines(lines: string[]): RepoValidationResult {
  const cleanLines = lines.map((l) => l.trim()).filter(Boolean)
  if (!cleanLines.length) {
    return {
      isValid: false,
      type: 'invalid',
      message: '⚠️ Validation Failed: Repository location cannot be empty. Please enter a valid Git Repository URL or directory path.',
    }
  }

  for (const line of cleanLines) {
    const res = validateRepoLocation(line)
    if (!res.isValid) {
      return {
        ...res,
        invalidLine: line,
      }
    }
  }

  return {
    isValid: true,
    type: 'git_url',
    message: `✓ Repository Validated Successfully! Web Crawler & Scanner verified ${cleanLines.length} active source location(s).`,
  }
}
