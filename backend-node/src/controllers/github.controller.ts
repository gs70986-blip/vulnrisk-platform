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

export const exportSearchCorpus = async (req: Request, res: Response) => {
  try {
    const targetCount = parseInt(req.query.targetCount as string, 10) || 2200;
    const includeComments = req.query.includeComments !== 'false';
    const maxCommentsPerItem = parseInt(req.query.maxCommentsPerItem as string, 10) || 30;
    const corpusType = (req.query.corpusType as 'security' | 'negative') || 'security';

    if (targetCount < 1 || targetCount > 10000) {
      return res.status(400).json({ error: 'targetCount must be between 1 and 10000' });
    }

    if (corpusType !== 'security' && corpusType !== 'negative') {
      return res.status(400).json({ error: 'corpusType must be "security" or "negative"' });
    }

    console.log(`[GitHub Export] Starting export with targetCount=${targetCount}, includeComments=${includeComments}, corpusType=${corpusType}`);

    const result = await githubService.exportSearchCorpus({
      targetCount,
      includeComments,
      maxCommentsPerItem,
      corpusType,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error exporting search corpus:', error);
    res.status(500).json({ error: error.message || 'Failed to export search corpus' });
  }
};

