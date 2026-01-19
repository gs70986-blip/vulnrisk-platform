import axios, { AxiosError } from 'axios';

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
}

