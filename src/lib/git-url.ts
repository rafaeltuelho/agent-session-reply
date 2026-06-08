/**
 * Resolves user-friendly Git hosting URLs to raw content URLs
 * that can be fetched client-side.
 */
export function resolveRawUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are supported');
  }

  // Already-raw GitHub URLs — pass through
  if (
    parsed.hostname === 'raw.githubusercontent.com' ||
    parsed.hostname === 'gist.githubusercontent.com'
  ) {
    return url;
  }

  // GitHub blob URLs → raw.githubusercontent.com
  if (parsed.hostname === 'github.com') {
    // pathname: /user/repo/blob/branch/path/to/file
    const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (match) {
      const [, user, repo, rest] = match;
      return `https://raw.githubusercontent.com/${user}/${repo}/${rest}`;
    }
    // Not a blob URL — pass through
    return url;
  }

  // GitHub Gist URLs → gist.githubusercontent.com
  if (parsed.hostname === 'gist.github.com') {
    const pathname = parsed.pathname.replace(/\/$/, '');
    return `https://gist.githubusercontent.com${pathname}/raw`;
  }

  // GitLab URLs
  if (parsed.hostname === 'gitlab.com' || parsed.hostname.endsWith('.gitlab.com')) {
    // Already a raw snippet URL — pass through
    if (parsed.pathname.match(/\/-\/snippets\/\d+\/raw/)) {
      return url;
    }

    // GitLab snippet URLs → append /raw
    // Matches: /-/snippets/123 or /user/project/-/snippets/123
    const snippetMatch = parsed.pathname.match(/^(.*\/-\/snippets\/\d+)\/?$/);
    if (snippetMatch) {
      return `https://${parsed.hostname}${snippetMatch[1]}/raw`;
    }

    // GitLab blob URLs → replace /-/blob/ with /-/raw/
    if (parsed.pathname.includes('/-/blob/')) {
      const rawPath = parsed.pathname.replace('/-/blob/', '/-/raw/');
      return `https://${parsed.hostname}${rawPath}${parsed.search}`;
    }

    // Other GitLab URLs — pass through
    return url;
  }

  // Any other HTTPS URL — pass through
  return url;
}

