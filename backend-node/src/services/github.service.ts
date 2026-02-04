import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Types
export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  type: 'issue' | 'pull' | 'commit';
  number?: number; // For issue/pull
  sha?: string; // For commit
}

export interface GitHubFetchRequest {
  url: string;
}

export interface GitHubFetchResponse {
  sourceType: 'issue' | 'pull' | 'commit';
  sample_id: string;
  text_description: string;
  meta: {
    owner: string;
    repo: string;
    number: number | null;
    sha: string | null;
    truncated: boolean;
  };
}

export interface GitHubBatchFetchRequest {
  urls: string[];
}

export interface GitHubBatchFetchResult {
  url: string;
  success: boolean;
  data?: GitHubFetchResponse;
  error?: string;
}

export interface GitHubBatchFetchResponse {
  results: GitHubBatchFetchResult[];
  successCount: number;
  failureCount: number;
  totalCount: number;
}

export interface GitHubSearchIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  repository_url: string;
  user: {
    login: string;
  };
  comments: number;
  comments_url: string;
}

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchIssue[];
}

export interface GitHubComment {
  id: number;
  body: string;
  user: {
    login: string;
  };
  created_at: string;
}

export interface CorpusEntry {
  id: string; // unique identifier: {owner}/{repo}#{number}
  type: 'issue' | 'pr';
  title: string;
  body: string;
  comments: Array<{
    body: string;
    author: string;
    created_at: string;
  }>;
  url: string;
  owner: string;
  repo: string;
  number: number;
  state: string;
  created_at: string;
  updated_at: string;
  search_query: string; // which query found this item
}

export interface ExportSearchCorpusOptions {
  targetCount?: number;
  includeComments?: boolean;
  maxCommentsPerItem?: number;
  corpusType?: 'security' | 'negative';
}

interface CacheEntry {
  expiresAt: number;
  payload: GitHubFetchResponse;
}

// Constants
const MAX_TEXT_LENGTH = 12000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GITHUB_API_BASE = 'https://api.github.com';

// In-memory cache
const cache = new Map<string, CacheEntry>();

export class GitHubService {
  /**
   * Parse and validate GitHub URL
   */
  parseGitHubUrl(url: string): ParsedGitHubUrl {
    try {
      const urlObj = new URL(url);

      // Validate host
      if (urlObj.hostname !== 'github.com') {
        throw new Error('URL must be from github.com');
      }

      // Parse path: /{owner}/{repo}/{type}/{id}
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length < 4) {
        throw new Error('Invalid GitHub URL format');
      }

      const [owner, repo, type, id] = pathParts;

      // Validate type
      if (type !== 'issues' && type !== 'pull' && type !== 'commit') {
        throw new Error('URL must be an issue, pull request, or commit');
      }

      // Validate ID based on type
      if (type === 'issues' || type === 'pull') {
        const number = parseInt(id, 10);
        if (isNaN(number) || number <= 0) {
          throw new Error('Issue/PR number must be a positive integer');
        }
        return {
          owner,
          repo,
          type: type === 'issues' ? 'issue' : 'pull',
          number,
        };
      } else {
        // Commit: SHA must be 7-40 hex characters
        if (!/^[0-9a-f]{7,40}$/i.test(id)) {
          throw new Error('Commit SHA must be 7-40 hexadecimal characters');
        }
        return {
          owner,
          repo,
          type: 'commit',
          sha: id,
        };
      }
    } catch (error: any) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }

  /**
   * Fetch issue or PR content from GitHub API
   */
  async fetchIssueOrPR(owner: string, repo: string, number: number): Promise<string> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${number}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'vulnrisk/1.0',
    };

    // Add token if available
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    try {
      const response = await axios.get(url, { headers });
      const title = response.data.title || '';
      const body = response.data.body || '';
      return `${title}\n\n${body}`.trim();
    } catch (error) {
      this.handleAxiosError(error, 'Failed to fetch issue/PR');
    }
  }

  /**
   * Fetch commit content from GitHub API
   */
  async fetchCommit(owner: string, repo: string, sha: string): Promise<string> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'vulnrisk/1.0',
    };

    // Add token if available
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    try {
      const response = await axios.get(url, { headers });
      return response.data.commit?.message || '';
    } catch (error) {
      this.handleAxiosError(error, 'Failed to fetch commit');
    }
  }

  /**
   * Handle axios errors and throw user-friendly messages
   */
  private handleAxiosError(error: unknown, defaultMessage: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      if (axiosError.response) {
        // Has response (HTTP error)
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        let message = defaultMessage;

        if (status === 404) {
          message = 'GitHub resource not found (404)';
        } else if (status === 403) {
          message = 'GitHub API rate limit exceeded or access forbidden (403)';
        } else if (status === 401) {
          message = 'GitHub API authentication failed (401)';
        } else if (data?.message) {
          // Use GitHub's error message if available, but truncate if too long
          const githubMsg = String(data.message);
          message = githubMsg.length > 200 ? githubMsg.substring(0, 200) + '...' : githubMsg;
        }

        throw new Error(message);
      } else {
        // No response (network error)
        throw new Error('Network error: Failed to connect to GitHub API');
      }
    }
    throw new Error(defaultMessage);
  }

  /**
   * Truncate text to max length
   */
  private truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
    if (text.length <= maxLength) {
      return { text, truncated: false };
    }
    return { text: text.substring(0, maxLength), truncated: true };
  }

  /**
   * Generate sample_id from parsed URL
   */
  private generateSampleId(parsed: ParsedGitHubUrl): string {
    if (parsed.type === 'commit') {
      return `${parsed.owner}/${parsed.repo}@${parsed.sha}`;
    } else {
      return `${parsed.owner}/${parsed.repo}#${parsed.number}`;
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt < now) {
        cache.delete(key);
      }
    }
  }

  /**
   * Fetch GitHub content (main method)
   */
  async fetchGitHubContent(request: GitHubFetchRequest): Promise<GitHubFetchResponse> {
    // Check cache
    this.cleanCache();
    const cached = cache.get(request.url);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[GitHub Service] Cache hit for URL: ${request.url}`);
      return cached.payload;
    }

    console.log(`[GitHub Service] Cache miss for URL: ${request.url}`);

    // Parse URL
    const parsed = this.parseGitHubUrl(request.url);

    // Fetch content based on type
    let textDescription: string;
    if (parsed.type === 'commit') {
      textDescription = await this.fetchCommit(parsed.owner, parsed.repo, parsed.sha!);
    } else {
      textDescription = await this.fetchIssueOrPR(parsed.owner, parsed.repo, parsed.number!);
    }

    // Truncate if needed
    const { text: truncatedText, truncated } = this.truncateText(textDescription, MAX_TEXT_LENGTH);

    // Generate sample_id
    const sample_id = this.generateSampleId(parsed);

    // Build response
    const response: GitHubFetchResponse = {
      sourceType: parsed.type,
      sample_id,
      text_description: truncatedText,
      meta: {
        owner: parsed.owner,
        repo: parsed.repo,
        number: parsed.number || null,
        sha: parsed.sha || null,
        truncated,
      },
    };

    // Cache the response
    cache.set(request.url, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload: response,
    });

    return response;
  }

  /**
   * Batch fetch GitHub content
   * Uses controlled concurrency to avoid rate limiting
   */
  async batchFetchGitHubContent(
    request: GitHubBatchFetchRequest
  ): Promise<GitHubBatchFetchResponse> {
    const { urls } = request;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error('urls array is required and must not be empty');
    }

    // Limit concurrent requests to avoid rate limiting
    const CONCURRENT_LIMIT = 5;
    const results: GitHubBatchFetchResult[] = [];
    const urlSet = new Set(urls); // Remove duplicates

    // Process URLs in batches
    const urlArray = Array.from(urlSet);
    for (let i = 0; i < urlArray.length; i += CONCURRENT_LIMIT) {
      const batch = urlArray.slice(i, i + CONCURRENT_LIMIT);
      const batchPromises = batch.map(async (url) => {
        try {
          const data = await this.fetchGitHubContent({ url });
          return {
            url,
            success: true,
            data,
          } as GitHubBatchFetchResult;
        } catch (error: any) {
          return {
            url,
            success: false,
            error: error.message || 'Failed to fetch GitHub content',
          } as GitHubBatchFetchResult;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to be respectful to GitHub API
      if (i + CONCURRENT_LIMIT < urlArray.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      results,
      successCount,
      failureCount,
      totalCount: results.length,
    };
  }

  /**
   * Get GitHub API headers with authentication
   */
  private getGitHubHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'vulnrisk/1.0',
    };

    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    return headers;
  }

  /**
   * Search GitHub issues/PRs using Search API
   */
  async searchIssuesAndPRs(
    query: string,
    page: number = 1,
    perPage: number = 100
  ): Promise<GitHubSearchResponse> {
    const url = `${GITHUB_API_BASE}/search/issues`;
    const headers = this.getGitHubHeaders();

    // GitHub Search API allows max 100 results per page
    // NOTE: Avoid sort=updated which causes extremely high overlap across queries.
    // Using sort=created helps reduce the "high overlap trap" for broad negative queries.
    const params = {
      q: query,
      page: page.toString(),
      per_page: Math.min(perPage, 100).toString(),
      sort: 'created',
      order: 'desc',
    };

    console.log(`[GitHub API] Searching: ${query.substring(0, 150)}...`);
    console.log(`[GitHub API] URL: ${url}, params:`, params);

    try {
      const response = await axios.get<GitHubSearchResponse>(url, {
        headers,
        params,
      });
      console.log(`[GitHub API] Success: total_count=${response.data.total_count}, items.length=${response.data.items.length}`);
      return response.data;
    } catch (error: any) {
      console.error(`[GitHub API] Error in searchIssuesAndPRs:`, error.message);
      if (error.response) {
        console.error(`[GitHub API] Status: ${error.response.status}`);
        console.error(`[GitHub API] Data:`, JSON.stringify(error.response.data, null, 2));
      }
      this.handleAxiosError(error, 'Failed to search GitHub issues/PRs');
      throw error; // This will never be reached, but satisfies TypeScript
    }
  }

  /**
   * Fetch comments for an issue/PR
   */
  async fetchComments(
    owner: string,
    repo: string,
    number: number,
    maxComments: number = 30
  ): Promise<GitHubComment[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${number}/comments`;
    const headers = this.getGitHubHeaders();

    try {
      const response = await axios.get<GitHubComment[]>(url, {
        headers,
        params: {
          per_page: Math.min(maxComments, 100),
          page: 1,
        },
      });

      // Limit to maxComments
      return response.data.slice(0, maxComments);
    } catch (error) {
      // Comments are optional, so we don't throw on error
      console.warn(`Failed to fetch comments for ${owner}/${repo}#${number}:`, error);
      return [];
    }
  }

  /**
   * Parse repository URL to extract owner and repo
   */
  private parseRepositoryUrl(repoUrl: string): { owner: string; repo: string } | null {
    try {
      if (!repoUrl) return null;

      // `repository_url` from Search API is typically:
      // - https://api.github.com/repos/{owner}/{repo}
      // `html_url` style is:
      // - https://github.com/{owner}/{repo}
      const apiMatch = repoUrl.match(/api\.github\.com\/repos\/([^\/]+)\/([^\/]+)/i);
      if (apiMatch) return { owner: apiMatch[1], repo: apiMatch[2] };

      const webMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
      if (webMatch) return { owner: webMatch[1], repo: webMatch[2] };
    } catch (error) {
      // Ignore
    }
    return null;
  }

  /**
   * Convert GitHub search item to corpus entry
   */
  private async convertToCorpusEntry(
    item: GitHubSearchIssue,
    searchQuery: string,
    includeComments: boolean = false,
    maxComments: number = 30
  ): Promise<CorpusEntry> {
    const repoInfo = this.parseRepositoryUrl(item.repository_url);
    if (!repoInfo) {
      throw new Error(`Failed to parse repository URL: ${item.repository_url}`);
    }

    // Determine type from URL or repository_url
    const isPR = item.html_url.includes('/pull/');
    const type: 'issue' | 'pr' = isPR ? 'pr' : 'issue';

    // Fetch comments if requested
    let comments: CorpusEntry['comments'] = [];
    if (includeComments && item.comments > 0) {
      try {
        const fetchedComments = await this.fetchComments(
          repoInfo.owner,
          repoInfo.repo,
          item.number,
          maxComments
        );
        comments = fetchedComments.map((comment) => ({
          body: comment.body || '',
          author: comment.user?.login || 'unknown',
          created_at: comment.created_at,
        }));
      } catch (error) {
        console.warn(`Failed to fetch comments for ${item.html_url}:`, error);
      }
    }

    return {
      id: `${repoInfo.owner}/${repoInfo.repo}#${item.number}`,
      type,
      title: item.title || '',
      body: item.body || '',
      comments,
      url: item.html_url,
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      number: item.number,
      state: item.state,
      created_at: item.created_at,
      updated_at: item.updated_at,
      search_query: searchQuery,
    };
  }

  /**
   * Export search corpus to JSONL and summary files
   */
  async exportSearchCorpus(
    options: ExportSearchCorpusOptions = {}
  ): Promise<{
    totalFetched: number;
    totalDeduped: number;
    outputPath: string;
    summaryPath: string;
    summary: any;
  }> {
    const {
      targetCount = 2200,
      includeComments = true,
      maxCommentsPerItem = 30,
      corpusType = 'security',
    } = options;

    // NEG_EXCLUDE: Negative exclusion list using individual -terms (not OR groups)
    // This avoids counting as OR operators in GitHub Search API
    // Format: -term1 -term2 -term3 (each - is a separate NOT operator, but doesn't count as OR)
    const NEG_EXCLUDE = `-vulnerability -cve -xss -sqli -"sql injection" -rce -exploit`;
    
    // LOCAL_SECURITY_REGEX: Comprehensive regex for local filtering after fetching
    // Used to filter out security-related content from negative corpus
    // IMPORTANT: Use word boundaries and specific patterns to avoid false positives
    // Patterns that are too broad (like "error", "crash") are NOT included here
    const LOCAL_SECURITY_REGEX = new RegExp(
      [
        '\\bvulnerability\\b', '\\bvulnerable\\b', '\\bcve-\\d{4}', '\\bcve\\s*\\d{4}', // CVE references (CVE-2024, CVE 2024)
        '\\bxss\\b', 'cross[- ]site\\s+scripting', // XSS (but NOT "css" styling)
        '\\bsqli\\b', 'sql\\s+injection', 'command\\s+injection',
        '\\brce\\b', 'remote\\s+code\\s+execution',
        '\\bexploit\\b', 'privilege\\s+escalation', 'auth\\s+bypass',
        '\\bcsrf\\b', '\\bssrf\\b', 'open\\s+redirect',
        'path\\s+traversal', 'directory\\s+traversal',
        'hardcoded\\s+secret', 'token\\s+theft', 'information\\s+disclosure'
      ].join('|'),
      'i'
    );

    // Security keyword query templates (renamed from queryTemplates)
    const SECURITY_QUERIES = [
      { keyword: 'XSS', query: 'XSS OR "cross-site scripting" is:issue' },
      { keyword: 'XSS', query: 'XSS OR "cross-site scripting" is:pr' },
      { keyword: 'SQLi', query: 'SQL injection OR SQLi OR "SQL injection" is:issue' },
      { keyword: 'SQLi', query: 'SQL injection OR SQLi OR "SQL injection" is:pr' },
      { keyword: 'RCE', query: 'RCE OR "remote code execution" OR "code execution" is:issue' },
      { keyword: 'RCE', query: 'RCE OR "remote code execution" OR "code execution" is:pr' },
      { keyword: 'SSRF', query: 'SSRF OR "server-side request forgery" is:issue' },
      { keyword: 'SSRF', query: 'SSRF OR "server-side request forgery" is:pr' },
      { keyword: 'Auth bypass', query: 'authentication bypass OR "auth bypass" OR "privilege escalation" is:issue' },
      { keyword: 'Auth bypass', query: 'authentication bypass OR "auth bypass" OR "privilege escalation" is:pr' },
      { keyword: 'Traversal', query: 'path traversal OR "directory traversal" OR "../" is:issue' },
      { keyword: 'Traversal', query: 'path traversal OR "directory traversal" OR "../" is:pr' },
      { keyword: 'Deserialization', query: 'deserialization OR "unserialize" OR "pickle" is:issue' },
      { keyword: 'Deserialization', query: 'deserialization OR "unserialize" OR "pickle" is:pr' },
      { keyword: 'CVE', query: 'CVE-2024 OR CVE-2023 OR CVE-2022 is:issue' },
      { keyword: 'CVE', query: 'CVE-2024 OR CVE-2023 OR CVE-2022 is:pr' },
    ];

    // Negative queries for Stage A training (non-security issues/PRs)
    // Use <NEG_EXCLUDE> placeholder which will be replaced with NEG_EXCLUDE
    // Strategy: Split OR groups into single-keyword queries to avoid GitHub Search API OR semantics issues
    // This prevents queries from returning identical results despite different keywords
    // Date range: Split by year (2021-2025) to reduce overlap and increase diversity
    // Note: No comments:>0 requirement by default (can add separate queries if needed)
    const NEGATIVE_QUERIES_TEMPLATE = [
      // Bug-related queries (split: bug, crash, regression, broken) - 2021-2025
      { key: 'neg_issue_bug_2021', query: `is:issue in:title,body bug created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_crash_2021', query: `is:issue in:title,body crash created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_regression_2021', query: `is:issue in:title,body regression created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_broken_2021', query: `is:issue in:title,body broken created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_bug_2022', query: `is:issue in:title,body bug created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_crash_2022', query: `is:issue in:title,body crash created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_regression_2022', query: `is:issue in:title,body regression created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_broken_2022', query: `is:issue in:title,body broken created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_bug_2023', query: `is:issue in:title,body bug created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_crash_2023', query: `is:issue in:title,body crash created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_regression_2023', query: `is:issue in:title,body regression created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_broken_2023', query: `is:issue in:title,body broken created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_bug_2024', query: `is:issue in:title,body bug created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_crash_2024', query: `is:issue in:title,body crash created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_regression_2024', query: `is:issue in:title,body regression created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_broken_2024', query: `is:issue in:title,body broken created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_bug_2025', query: `is:issue in:title,body bug created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_crash_2025', query: `is:issue in:title,body crash created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_regression_2025', query: `is:issue in:title,body regression created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_broken_2025', query: `is:issue in:title,body broken created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      
      // Build-related queries (split: build, compile, install) - 2021-2025
      { key: 'neg_issue_build_2021', query: `is:issue in:title,body build created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_compile_2021', query: `is:issue in:title,body compile created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_install_2021', query: `is:issue in:title,body install created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_build_2022', query: `is:issue in:title,body build created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_compile_2022', query: `is:issue in:title,body compile created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_install_2022', query: `is:issue in:title,body install created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_build_2023', query: `is:issue in:title,body build created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_compile_2023', query: `is:issue in:title,body compile created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_install_2023', query: `is:issue in:title,body install created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_build_2024', query: `is:issue in:title,body build created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_compile_2024', query: `is:issue in:title,body compile created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_install_2024', query: `is:issue in:title,body install created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_build_2025', query: `is:issue in:title,body build created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_compile_2025', query: `is:issue in:title,body compile created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_install_2025', query: `is:issue in:title,body install created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      
      // Test-related queries (split: test, tests, unittest) - 2021-2025
      { key: 'neg_issue_test_2021', query: `is:issue in:title,body test created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_tests_2021', query: `is:issue in:title,body tests created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_unittest_2021', query: `is:issue in:title,body unittest created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_test_2022', query: `is:issue in:title,body test created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_tests_2022', query: `is:issue in:title,body tests created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_unittest_2022', query: `is:issue in:title,body unittest created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_test_2023', query: `is:issue in:title,body test created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_tests_2023', query: `is:issue in:title,body tests created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_unittest_2023', query: `is:issue in:title,body unittest created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_test_2024', query: `is:issue in:title,body test created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_tests_2024', query: `is:issue in:title,body tests created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_unittest_2024', query: `is:issue in:title,body unittest created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_test_2025', query: `is:issue in:title,body test created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_tests_2025', query: `is:issue in:title,body tests created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_unittest_2025', query: `is:issue in:title,body unittest created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      
      // API-related queries (split: api, request, response) - 2021-2025
      { key: 'neg_issue_api_2021', query: `is:issue in:title,body api created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_request_2021', query: `is:issue in:title,body request created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_response_2021', query: `is:issue in:title,body response created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_api_2022', query: `is:issue in:title,body api created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_request_2022', query: `is:issue in:title,body request created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_response_2022', query: `is:issue in:title,body response created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_api_2023', query: `is:issue in:title,body api created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_request_2023', query: `is:issue in:title,body request created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_response_2023', query: `is:issue in:title,body response created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_api_2024', query: `is:issue in:title,body api created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_request_2024', query: `is:issue in:title,body request created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_response_2024', query: `is:issue in:title,body response created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_api_2025', query: `is:issue in:title,body api created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_request_2025', query: `is:issue in:title,body request created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_response_2025', query: `is:issue in:title,body response created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      
      // Performance queries (split: performance, slow, latency) - 2021-2025
      { key: 'neg_issue_performance_2021', query: `is:issue in:title,body performance created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_slow_2021', query: `is:issue in:title,body slow created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_latency_2021', query: `is:issue in:title,body latency created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_performance_2022', query: `is:issue in:title,body performance created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_slow_2022', query: `is:issue in:title,body slow created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_latency_2022', query: `is:issue in:title,body latency created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_performance_2023', query: `is:issue in:title,body performance created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_slow_2023', query: `is:issue in:title,body slow created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_latency_2023', query: `is:issue in:title,body latency created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_performance_2024', query: `is:issue in:title,body performance created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_slow_2024', query: `is:issue in:title,body slow created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_latency_2024', query: `is:issue in:title,body latency created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_performance_2025', query: `is:issue in:title,body performance created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_slow_2025', query: `is:issue in:title,body slow created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_latency_2025', query: `is:issue in:title,body latency created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      
      // UI/UX queries (split: ui, ux, layout) - 2021-2025
      { key: 'neg_issue_ui_2021', query: `is:issue in:title,body ui created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ux_2021', query: `is:issue in:title,body ux created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_layout_2021', query: `is:issue in:title,body layout created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ui_2022', query: `is:issue in:title,body ui created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ux_2022', query: `is:issue in:title,body ux created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_layout_2022', query: `is:issue in:title,body layout created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ui_2023', query: `is:issue in:title,body ui created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ux_2023', query: `is:issue in:title,body ux created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_layout_2023', query: `is:issue in:title,body layout created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ui_2024', query: `is:issue in:title,body ui created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ux_2024', query: `is:issue in:title,body ux created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_layout_2024', query: `is:issue in:title,body layout created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ui_2025', query: `is:issue in:title,body ui created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ux_2025', query: `is:issue in:title,body ux created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_layout_2025', query: `is:issue in:title,body layout created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      
      // Documentation queries (split: docs, documentation, README) - 2021-2025
      { key: 'neg_issue_docs_2021', query: `is:issue in:title,body docs created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_documentation_2021', query: `is:issue in:title,body documentation created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_readme_2021', query: `is:issue in:title,body README created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_docs_2022', query: `is:issue in:title,body docs created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_documentation_2022', query: `is:issue in:title,body documentation created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_readme_2022', query: `is:issue in:title,body README created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_docs_2023', query: `is:issue in:title,body docs created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_documentation_2023', query: `is:issue in:title,body documentation created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_readme_2023', query: `is:issue in:title,body README created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_docs_2024', query: `is:issue in:title,body docs created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_documentation_2024', query: `is:issue in:title,body documentation created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_readme_2024', query: `is:issue in:title,body README created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_docs_2025', query: `is:issue in:title,body docs created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_documentation_2025', query: `is:issue in:title,body documentation created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_readme_2025', query: `is:issue in:title,body README created:2025-01-01..2025-12-31 <NEG_EXCLUDE>` },
      
      // Additional diverse queries - keep some OR groups for less critical topics
      { key: 'neg_issue_dependency_2021', query: `is:issue in:title,body dependency created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_dependency_2022', query: `is:issue in:title,body dependency created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_dependency_2023', query: `is:issue in:title,body dependency created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_dependency_2024', query: `is:issue in:title,body dependency created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_npm_2021', query: `is:issue in:title,body npm created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_npm_2022', query: `is:issue in:title,body npm created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_npm_2023', query: `is:issue in:title,body npm created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_npm_2024', query: `is:issue in:title,body npm created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_pip_2021', query: `is:issue in:title,body pip created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_pip_2022', query: `is:issue in:title,body pip created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_pip_2023', query: `is:issue in:title,body pip created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_pip_2024', query: `is:issue in:title,body pip created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_maven_2021', query: `is:issue in:title,body maven created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_maven_2022', query: `is:issue in:title,body maven created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_maven_2023', query: `is:issue in:title,body maven created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_maven_2024', query: `is:issue in:title,body maven created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ci_2021', query: `is:issue in:title,body ci created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ci_2022', query: `is:issue in:title,body ci created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ci_2023', query: `is:issue in:title,body ci created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_ci_2024', query: `is:issue in:title,body ci created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_workflow_2021', query: `is:issue in:title,body workflow created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_workflow_2022', query: `is:issue in:title,body workflow created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_workflow_2023', query: `is:issue in:title,body workflow created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_workflow_2024', query: `is:issue in:title,body workflow created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_memory_leak_2021', query: `is:issue in:title,body "memory leak" created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_memory_leak_2022', query: `is:issue in:title,body "memory leak" created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_memory_leak_2023', query: `is:issue in:title,body "memory leak" created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_memory_leak_2024', query: `is:issue in:title,body "memory leak" created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_optimize_2021', query: `is:issue in:title,body optimize created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_optimize_2022', query: `is:issue in:title,body optimize created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_optimize_2023', query: `is:issue in:title,body optimize created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_optimize_2024', query: `is:issue in:title,body optimize created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_css_2021', query: `is:issue in:title,body css created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_css_2022', query: `is:issue in:title,body css created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_css_2023', query: `is:issue in:title,body css created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_css_2024', query: `is:issue in:title,body css created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_modal_2021', query: `is:issue in:title,body modal created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_modal_2022', query: `is:issue in:title,body modal created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_modal_2023', query: `is:issue in:title,body modal created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_modal_2024', query: `is:issue in:title,body modal created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_pr_refactor_2021', query: `is:pr in:title,body refactor created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_pr_refactor_2022', query: `is:pr in:title,body refactor created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_pr_refactor_2023', query: `is:pr in:title,body refactor created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_pr_refactor_2024', query: `is:pr in:title,body refactor created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_pr_cleanup_2021', query: `is:pr in:title,body cleanup created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_pr_cleanup_2022', query: `is:pr in:title,body cleanup created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_pr_cleanup_2023', query: `is:pr in:title,body cleanup created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_pr_cleanup_2024', query: `is:pr in:title,body cleanup created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_failing_2021', query: `is:issue in:title,body failing created:2021-01-01..2021-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_failing_2022', query: `is:issue in:title,body failing created:2022-01-01..2022-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_failing_2023', query: `is:issue in:title,body failing created:2023-01-01..2023-12-31 <NEG_EXCLUDE>` },
      { key: 'neg_issue_failing_2024', query: `is:issue in:title,body failing created:2024-01-01..2024-12-31 <NEG_EXCLUDE>` },
    ];

    // Process queries based on corpusType
    let queryTemplates: Array<{ keyword: string; query: string; key?: string }> = [];
    let maxQueryLength = 0;
    if (corpusType === 'negative') {
      // Replace <NEG_EXCLUDE> with NEG_EXCLUDE and normalize whitespace
      queryTemplates = NEGATIVE_QUERIES_TEMPLATE.map(({ key, query }) => {
        const finalQuery = query.replace('<NEG_EXCLUDE>', NEG_EXCLUDE).replace(/\s+/g, ' ').trim();
        // Track max query length
        if (finalQuery.length > maxQueryLength) {
          maxQueryLength = finalQuery.length;
        }
        // Validate query length (GitHub Search API limit is 256 characters)
        // Count OR operators (GitHub API limit is 5 AND/OR/NOT operators total)
        const orCount = (finalQuery.match(/\bOR\b/gi) || []).length;
        // Count negative exclusions (each -term is a NOT operator, but doesn't count as OR)
        const negCount = (finalQuery.match(/\s-/g) || []).length;
        // Count AND operators (if any)
        const andCount = (finalQuery.match(/\bAND\b/gi) || []).length;
        const totalOperators = orCount + andCount; // NOT operators (-terms) don't count toward the 5 limit
        
        // Debug output: Print query details
        console.log(`[GitHub Export] Query ${key}:`);
        console.log(`  Length: ${finalQuery.length} chars`);
        console.log(`  OR count: ${orCount}`);
        console.log(`  AND count: ${andCount}`);
        console.log(`  Negative exclusions (-terms): ${negCount}`);
        console.log(`  Total AND/OR operators: ${totalOperators} (limit: 5)`);
        console.log(`  Query: ${finalQuery.substring(0, 200)}${finalQuery.length > 200 ? '...' : ''}`);
        
        if (finalQuery.length > 256) {
          console.warn(`[GitHub Export] WARNING: Query for ${key} is ${finalQuery.length} characters (exceeds 256 limit)`);
        } else if (totalOperators > 5) {
          console.warn(`[GitHub Export] WARNING: Query for ${key} uses ${totalOperators} AND/OR operators (exceeds 5 limit)`);
        } else {
          console.log(`[GitHub Export] Query ${key} validated: OK`);
        }
        
        return {
          keyword: key,
          query: finalQuery,
          key,
        };
      });
    } else {
      // Security queries (default)
      queryTemplates = SECURITY_QUERIES;
      // Calculate max query length for security queries too
      queryTemplates.forEach(({ query }) => {
        if (query.length > maxQueryLength) {
          maxQueryLength = query.length;
        }
      });
    }

    const seenIds = new Set<string>();
    const corpusEntries: CorpusEntry[] = [];
    let totalFetched = 0;
    let queryIndex = 0;
    const queryStats: Record<string, { fetched: number; deduped: number }> = {};
    let fallbackUsed = false;
    const perQueryCounts: Record<string, number> = {};
    let filteredSecurityCount = 0; // Count of items filtered by LOCAL_SECURITY_REGEX
    
    // Step 5: Debug counters
    let missingKeyCount = 0;
    let duplicateCount = 0;
    let skipRepoParseCount = 0;

    console.log(`[GitHub Export] Starting corpus export (type: ${corpusType}), target: ${targetCount} unique items`);
    console.log(`[GitHub Export] Total query templates: ${queryTemplates.length}`);
    console.log(`[GitHub Export] First query template:`, queryTemplates[0] ? JSON.stringify(queryTemplates[0], null, 2) : 'none');
    
    // Check if local filter is disabled
    const enableLocalFilter = process.env.GITHUB_DISABLE_LOCAL_FILTER !== 'true';
    if (corpusType === 'negative') {
      console.log(`[GitHub Export] Local security filter: ${enableLocalFilter ? 'ENABLED' : 'DISABLED (via GITHUB_DISABLE_LOCAL_FILTER=true)'}`);
      if (!enableLocalFilter) {
        console.log(`[GitHub Export] WARNING: Local security filter is DISABLED. All items will be kept regardless of security content.`);
      }
    }

    // Iterate through query templates until we have enough unique items
    while (seenIds.size < targetCount && queryIndex < queryTemplates.length) {
      const { keyword, query, key } = queryTemplates[queryIndex];
      // 对于negative类型，使用key；对于security类型，使用keyword
      const queryKey = key || `${keyword}_${query}`;

      if (!queryStats[queryKey]) {
        queryStats[queryKey] = { fetched: 0, deduped: 0 };
      }

      console.log(`[GitHub Export] Processing query ${queryIndex + 1}/${queryTemplates.length}: ${queryKey}`);
      console.log(`[GitHub Export] Full query string: ${query}`);

      let page = 1;
      let hasMore = true;
      let queryFetched = 0;
      let queryDeduped = 0;

      while (hasMore && seenIds.size < targetCount) {
        try {
          // Rate limiting: wait between requests to avoid 429/403 errors
          // Significantly increased delay to avoid abuse detection (GitHub abuse detection is very sensitive)
          if (page > 1) {
            await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second delay between pages
          } else {
            // Even for first page, add a delay between different queries
            if (queryIndex > 0) {
              await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second delay between queries
            }
          }
          
          // Additional delay for negative corpus (more queries = higher risk of abuse detection)
          if (corpusType === 'negative') {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Extra 2 seconds for negative corpus
          }

          console.log(`[GitHub Export] Fetching page ${page} for query: ${query.substring(0, 100)}...`);
          const searchResult = await this.searchIssuesAndPRs(query, page, 100);
          console.log(`[GitHub Export] Page ${page} returned ${searchResult.items.length} items, total_count: ${searchResult.total_count}`);

          if (searchResult.items.length === 0) {
            console.log(`[GitHub Export] No more items for query, stopping pagination`);
            hasMore = false;
            break;
          }

          // Process each item
          for (const item of searchResult.items) {
            totalFetched++;
            queryFetched++;

            // Step 2 & 3: Use item.id as dedupe key (GitHub Search API global unique)
            // repoInfo is optional and should not affect deduplication
            const dedupeKey = item?.id != null
              ? String(item.id)
              : item?.html_url;

            if (!dedupeKey) {
              missingKeyCount++;
              continue;
            }

            // Skip if already seen
            if (seenIds.has(dedupeKey)) {
              duplicateCount++;
              continue;
            }

            seenIds.add(dedupeKey);
            queryDeduped++;

            // Step 3: Parse repo info (optional, for corpus entry fields)
            // Do NOT skip item if repo parsing fails
            const repoInfo = this.parseRepositoryUrl(item.repository_url);
            if (!repoInfo) {
              skipRepoParseCount++;
              // Continue processing even if repo parsing fails
            }

            try {
              const corpusEntry = await this.convertToCorpusEntry(
                item,
                query,
                includeComments,
                maxCommentsPerItem
              );
              
              // Local security filtering for negative corpus
              // Can be disabled via environment variable GITHUB_DISABLE_LOCAL_FILTER=true
              const enableLocalFilter = process.env.GITHUB_DISABLE_LOCAL_FILTER !== 'true';
              
              if (corpusType === 'negative' && enableLocalFilter) {
                // Construct full text: title + body + comments
                const fullText = [
                  corpusEntry.title || '',
                  corpusEntry.body || '',
                  ...(corpusEntry.comments || []).map(c => c.body || '')
                ].join(' ').toLowerCase();
                
                // Filter out security-related content using LOCAL_SECURITY_REGEX
                const securityMatch = LOCAL_SECURITY_REGEX.test(fullText);
                if (securityMatch) {
                  // Debug: Log first 10 filtered items to understand what's being filtered
                  if (filteredSecurityCount < 10) {
                    const matches = fullText.match(LOCAL_SECURITY_REGEX);
                    console.log(`[GitHub Export] Filtered security-related item: ${dedupeKey}`);
                    console.log(`  Matched patterns: ${matches ? matches.slice(0, 3).join(', ') : 'unknown'}`);
                    console.log(`  Title: ${corpusEntry.title?.substring(0, 150)}`);
                    console.log(`  Body preview: ${(corpusEntry.body || '').substring(0, 200)}...`);
                    console.log(`  Full text length: ${fullText.length} chars`);
                  }
                  filteredSecurityCount++;
                  seenIds.delete(dedupeKey); // Remove from seen
                  queryDeduped--;
                  continue; // Skip this item
                }
              } else if (corpusType === 'negative' && !enableLocalFilter) {
                // Local filter disabled - log for debugging
                if (filteredSecurityCount < 5) {
                  console.log(`[GitHub Export] Local filter disabled - keeping item: ${dedupeKey}`);
                }
              }
              
              corpusEntries.push(corpusEntry);

              // Small delay to avoid rate limiting
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
              console.warn(`Failed to convert item ${dedupeKey}:`, error);
              seenIds.delete(dedupeKey); // Remove from seen if conversion failed
              queryDeduped--;
            }

            // Check if we've reached target
            if (seenIds.size >= targetCount) {
              hasMore = false;
              break;
            }
          }

          // Check if there are more pages
          const totalPages = Math.ceil(searchResult.total_count / 100);
          if (page >= totalPages || page >= 10) {
            // GitHub Search API limits to 1000 results (10 pages)
            hasMore = false;
          } else {
            page++;
          }
        } catch (error: any) {
          console.error(`[GitHub Export] Error fetching page ${page} for query "${query.substring(0, 100)}...":`, error.message);
          if (error.response) {
            console.error(`[GitHub Export] Response status: ${error.response.status}`);
            console.error(`[GitHub Export] Response data:`, JSON.stringify(error.response.data, null, 2));
          }
          if (error.stack) {
            console.error(`[GitHub Export] Stack trace:`, error.stack);
          }
          // If rate limited, wait longer and continue with next query
          if (error.response?.status === 403 || error.response?.status === 429) {
            console.log(`[GitHub Export] Rate limited (${error.response?.status}), waiting 120 seconds before continuing...`);
            await new Promise((resolve) => setTimeout(resolve, 120000)); // Wait 2 minutes
            // Continue to next query instead of stopping pagination
            hasMore = false;
            // Don't break the outer loop, continue with next query
          } else {
            console.log(`[GitHub Export] Non-rate-limit error, stopping pagination for this query`);
            hasMore = false;
          }
        }
      }

      queryStats[queryKey].fetched += queryFetched;
      queryStats[queryKey].deduped += queryDeduped;
      perQueryCounts[queryKey] = (perQueryCounts[queryKey] || 0) + queryDeduped;

      console.log(
        `[GitHub Export] Query "${query}" completed: fetched ${queryFetched}, deduped ${queryDeduped}, total unique: ${seenIds.size}`
      );

      queryIndex++;
    }

    // Fallback mechanism for negative corpus if target not reached
    if (corpusType === 'negative' && seenIds.size < targetCount) {
      console.log(`[GitHub Export] Target not reached (${seenIds.size}/${targetCount}), applying fallback...`);
      fallbackUsed = true;

      // Fallback 1: Add 2022 queries (simplified to ≤5 OR operators)
      const fallbackQueries2022 = [
        { key: 'neg_issue_bug_2022', query: `is:issue in:title,body (bug OR crash OR error) created:2022-01-01..2022-12-31 ${NEG_EXCLUDE.replace(/\s+/g, ' ').trim()}` },
      ];

      for (const { key, query } of fallbackQueries2022) {
        if (seenIds.size >= targetCount) break;

        const queryKey = key;
        if (!queryStats[queryKey]) {
          queryStats[queryKey] = { fetched: 0, deduped: 0 };
        }

        console.log(`[GitHub Export] Fallback query: ${query}`);

        let page = 1;
        let hasMore = true;
        let queryFetched = 0;
        let queryDeduped = 0;

        while (hasMore && seenIds.size < targetCount) {
          try {
            if (page > 1) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            const searchResult = await this.searchIssuesAndPRs(query, page, 100);
            if (searchResult.items.length === 0) {
              hasMore = false;
              break;
            }

            for (const item of searchResult.items) {
              totalFetched++;
              queryFetched++;

              // Step 2 & 3: Use item.id as dedupe key
              const dedupeKey = item?.id != null
                ? String(item.id)
                : item?.html_url;

              if (!dedupeKey) {
                missingKeyCount++;
                continue;
              }

              if (seenIds.has(dedupeKey)) {
                duplicateCount++;
                continue;
              }

              seenIds.add(dedupeKey);
              queryDeduped++;

              // Step 3: Parse repo info (optional)
              const repoInfo = this.parseRepositoryUrl(item.repository_url);
              if (!repoInfo) {
                skipRepoParseCount++;
              }

              try {
                const corpusEntry = await this.convertToCorpusEntry(
                  item,
                  query,
                  includeComments,
                  maxCommentsPerItem
                );
                
                // Local security filtering for negative corpus (fallback queries)
                const enableLocalFilter = process.env.GITHUB_DISABLE_LOCAL_FILTER !== 'true';
                if (corpusType === 'negative' && enableLocalFilter) {
                  const fullText = [
                    corpusEntry.title || '',
                    corpusEntry.body || '',
                    ...(corpusEntry.comments || []).map(c => c.body || '')
                  ].join(' ').toLowerCase();
                  
                  if (LOCAL_SECURITY_REGEX.test(fullText)) {
                    if (filteredSecurityCount < 10) {
                      console.log(`[GitHub Export] Filtered security-related item (fallback): ${dedupeKey}`);
                    }
                    filteredSecurityCount++;
                    seenIds.delete(dedupeKey);
                    queryDeduped--;
                    continue;
                  }
                }
                
                corpusEntries.push(corpusEntry);
                await new Promise((resolve) => setTimeout(resolve, 100));
              } catch (error) {
                console.warn(`Failed to convert item ${dedupeKey}:`, error);
                seenIds.delete(dedupeKey);
                queryDeduped--;
              }

              if (seenIds.size >= targetCount) {
                hasMore = false;
                break;
              }
            }

            const totalPages = Math.ceil(searchResult.total_count / 100);
            if (page >= totalPages || page >= 10) {
              hasMore = false;
            } else {
              page++;
            }
          } catch (error: any) {
            console.error(`Error in fallback query page ${page}:`, error.message);
            if (error.response?.status === 403 || error.response?.status === 429) {
              console.log(`[GitHub Export] Rate limited (${error.response?.status}) in fallback, waiting 120 seconds...`);
              await new Promise((resolve) => setTimeout(resolve, 120000)); // Wait 2 minutes
              hasMore = false; // Continue to next query
            } else {
              hasMore = false;
            }
          }
        }

        queryStats[queryKey].fetched += queryFetched;
        queryStats[queryKey].deduped += queryDeduped;
        perQueryCounts[queryKey] = (perQueryCounts[queryKey] || 0) + queryDeduped;
      }

      // Fallback 2: Relax comments requirement if still not enough
      if (seenIds.size < targetCount) {
        console.log(`[GitHub Export] Still not enough (${seenIds.size}/${targetCount}), relaxing comments requirement...`);
        
        const relaxedQueries = queryTemplates
          .filter(q => q.query.includes('comments:>0'))
          .map(q => ({
            key: q.key || q.keyword,
            query: q.query.replace('comments:>0', 'comments:>=0'),
          }));

        for (const { key, query } of relaxedQueries) {
          if (seenIds.size >= targetCount) break;

          const queryKey = `${key}_relaxed`;
          if (!queryStats[queryKey]) {
            queryStats[queryKey] = { fetched: 0, deduped: 0 };
          }

          console.log(`[GitHub Export] Relaxed query: ${query}`);

          let page = 1;
          let hasMore = true;
          let queryFetched = 0;
          let queryDeduped = 0;

          while (hasMore && seenIds.size < targetCount && page <= 5) { // Limit relaxed queries to 5 pages
            try {
              if (page > 1) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }

              const searchResult = await this.searchIssuesAndPRs(query, page, 100);
              if (searchResult.items.length === 0) {
                hasMore = false;
                break;
              }

              for (const item of searchResult.items) {
                totalFetched++;
                queryFetched++;

                // Step 2 & 3: Use item.id as dedupe key
                const dedupeKey = item?.id != null
                  ? String(item.id)
                  : item?.html_url;

                if (!dedupeKey) {
                  missingKeyCount++;
                  continue;
                }

                if (seenIds.has(dedupeKey)) {
                  duplicateCount++;
                  continue;
                }

                seenIds.add(dedupeKey);
                queryDeduped++;

                // Step 3: Parse repo info (optional)
                const repoInfo = this.parseRepositoryUrl(item.repository_url);
                if (!repoInfo) {
                  skipRepoParseCount++;
                }

                try {
                  const corpusEntry = await this.convertToCorpusEntry(
                    item,
                    query,
                    includeComments,
                    maxCommentsPerItem
                  );
                  
                  // Local security filtering for negative corpus (relaxed queries)
                  const enableLocalFilter = process.env.GITHUB_DISABLE_LOCAL_FILTER !== 'true';
                  if (corpusType === 'negative' && enableLocalFilter) {
                    const fullText = [
                      corpusEntry.title || '',
                      corpusEntry.body || '',
                      ...(corpusEntry.comments || []).map(c => c.body || '')
                    ].join(' ').toLowerCase();
                    
                    if (LOCAL_SECURITY_REGEX.test(fullText)) {
                      if (filteredSecurityCount < 10) {
                        console.log(`[GitHub Export] Filtered security-related item (relaxed): ${dedupeKey}`);
                      }
                      filteredSecurityCount++;
                      seenIds.delete(dedupeKey);
                      queryDeduped--;
                      continue;
                    }
                  }
                  
                  corpusEntries.push(corpusEntry);
                  await new Promise((resolve) => setTimeout(resolve, 100));
                } catch (error) {
                  console.warn(`Failed to convert item ${dedupeKey}:`, error);
                  seenIds.delete(dedupeKey);
                  queryDeduped--;
                }

                if (seenIds.size >= targetCount) {
                  hasMore = false;
                  break;
                }
              }

              const totalPages = Math.ceil(searchResult.total_count / 100);
              if (page >= totalPages || page >= 5) {
                hasMore = false;
              } else {
                page++;
              }
            } catch (error: any) {
              console.error(`Error in relaxed query page ${page}:`, error.message);
              if (error.response?.status === 403 || error.response?.status === 429) {
                await new Promise((resolve) => setTimeout(resolve, 60000));
              } else {
                hasMore = false;
              }
            }
          }

          queryStats[queryKey].fetched += queryFetched;
          queryStats[queryKey].deduped += queryDeduped;
          perQueryCounts[queryKey] = (perQueryCounts[queryKey] || 0) + queryDeduped;
        }
      }
    }

    // Ensure data directory exists
    // Try multiple possible locations
    let dataDir = path.join(process.cwd(), 'data');
    const possibleDirs = [
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), '..', 'data'),
      '/app/data',
      './data',
    ];

    for (const dir of possibleDirs) {
      try {
        const parentDir = path.dirname(dir);
        if (fs.existsSync(parentDir)) {
          dataDir = dir;
          break;
        }
      } catch (error) {
        // Ignore errors, try next directory
      }
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write JSONL file
    const jsonlPath = path.join(dataDir, 'github_corpus_issues_prs.jsonl');
    const jsonlStream = fs.createWriteStream(jsonlPath, { encoding: 'utf-8' });

    for (const entry of corpusEntries) {
      jsonlStream.write(JSON.stringify(entry) + '\n');
    }
    jsonlStream.end();

    // Create summary
    const totalDeduped = seenIds.size;
    const uniqueRatio = totalFetched > 0 ? Number((totalDeduped / totalFetched).toFixed(3)) : 0;
    
    const summary = {
      export_date: new Date().toISOString(),
      corpus_type: corpusType,
      total_fetched: totalFetched,
      total_deduped: totalDeduped,
      target_count: targetCount,
      queries_processed: queryTemplates.length,
      query_statistics: queryStats,
      per_query_counts: perQueryCounts,
      fallback_used: fallbackUsed,
      // Enhanced validation fields
      search_blacklist_length: NEG_EXCLUDE.length,
      max_query_length_observed: maxQueryLength,
      filtered_security_count: filteredSecurityCount,
      // Step 5: Debug counters
      missing_key_count: missingKeyCount,
      duplicate_count: duplicateCount,
      skip_repo_parse_count: skipRepoParseCount,
      unique_ratio: uniqueRatio,
      breakdown: {
        issues: corpusEntries.filter((e) => e.type === 'issue').length,
        pull_requests: corpusEntries.filter((e) => e.type === 'pr').length,
        with_comments: corpusEntries.filter((e) => e.comments.length > 0).length,
        total_comments: corpusEntries.reduce((sum, e) => sum + e.comments.length, 0),
      },
    };

    // Write summary file
    const summaryPath = path.join(dataDir, 'github_corpus_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

    console.log(`[GitHub Export] Export completed:`);
    console.log(`  Total fetched: ${totalFetched}`);
    console.log(`  Total deduped: ${seenIds.size}`);
    console.log(`  Filtered by security regex: ${filteredSecurityCount}`);
    console.log(`  Output: ${jsonlPath}`);
    console.log(`  Summary: ${summaryPath}`);
    
    if (corpusType === 'negative' && filteredSecurityCount > 0) {
      const filterRate = totalFetched > 0 ? ((filteredSecurityCount / totalFetched) * 100).toFixed(1) : '0';
      console.log(`[GitHub Export] WARNING: ${filterRate}% of items were filtered by security regex`);
      if (totalFetched > 0 && (filteredSecurityCount / totalFetched) > 0.8) {
        console.log(`[GitHub Export] WARNING: Filter rate is very high (>80%). Consider relaxing LOCAL_SECURITY_REGEX or checking if it's too strict.`);
      }
    }

    return {
      totalFetched,
      totalDeduped: seenIds.size,
      outputPath: jsonlPath,
      summaryPath,
      summary,
    };
  }
}

