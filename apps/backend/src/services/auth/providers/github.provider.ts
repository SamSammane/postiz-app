import { ProvidersInterface } from '@gitroom/backend/services/auth/providers.interface';

export class GithubProvider implements ProvidersInterface {
  generateLink(): string {
    return `https://github.com/login/oauth/authorize?client_id=${
      process.env.GITHUB_CLIENT_ID
    }&scope=user:email&redirect_uri=${encodeURIComponent(
      `${process.env.FRONTEND_URL}/settings`
    )}`;
  }

  async getToken(code: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.FRONTEND_URL}/settings`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get GitHub access token');
    }

    const { access_token, error } = await response.json();
    if (error || !access_token) {
      throw new Error(error || 'No access token returned from GitHub');
    }

    return access_token;
  }

  async getUser(access_token: string): Promise<{ email: string; id: string }> {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch GitHub user');
    }

    const data = await userResponse.json();

    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });

    if (!emailsResponse.ok) {
      throw new Error('Failed to fetch GitHub user emails');
    }

    const emails = await emailsResponse.json();
    if (!Array.isArray(emails) || !emails.length) {
      throw new Error('No email found for GitHub user');
    }

    return {
      email: emails[0].email,
      id: String(data.id),
    };
  }
}
