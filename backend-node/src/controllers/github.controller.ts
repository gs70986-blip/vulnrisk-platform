import { Request, Response } from 'express';
import { GitHubService } from '../services/github.service';

const githubService = new GitHubService();

export const fetchGitHubContent = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required and must be a string' });
    }

    const result = await githubService.fetchGitHubContent({ url });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching GitHub content:', error);
    res.status(400).json({ error: error.message || 'Failed to fetch GitHub content' });
  }
};

export const batchFetchGitHubContent = async (req: Request, res: Response) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urls is required and must be a non-empty array' });
    }

    // Validate each URL is a string
    for (const url of urls) {
      if (typeof url !== 'string') {
        return res.status(400).json({ error: 'All URLs must be strings' });
      }
    }

    const result = await githubService.batchFetchGitHubContent({ urls });

    res.json(result);
  } catch (error: any) {
    console.error('Error batch fetching GitHub content:', error);
    res.status(400).json({ error: error.message || 'Failed to batch fetch GitHub content' });
  }
};

