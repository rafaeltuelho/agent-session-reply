import { describe, it, expect } from 'vitest';
import { resolveRawUrl } from '../git-url';

describe('resolveRawUrl', () => {
  describe('GitHub blob URLs', () => {
    it('converts a simple blob URL to raw', () => {
      expect(
        resolveRawUrl('https://github.com/user/repo/blob/main/file.json'),
      ).toBe('https://raw.githubusercontent.com/user/repo/main/file.json');
    });

    it('handles nested file paths', () => {
      expect(
        resolveRawUrl('https://github.com/user/repo/blob/main/path/to/file.json'),
      ).toBe('https://raw.githubusercontent.com/user/repo/main/path/to/file.json');
    });

    it('handles branches with slashes', () => {
      expect(
        resolveRawUrl('https://github.com/user/repo/blob/feature/branch/file.json'),
      ).toBe('https://raw.githubusercontent.com/user/repo/feature/branch/file.json');
    });

    it('passes through non-blob GitHub URLs unchanged', () => {
      const url = 'https://github.com/user/repo';
      expect(resolveRawUrl(url)).toBe(url);
    });
  });

  describe('GitHub Gist URLs', () => {
    it('converts gist URL with user to raw', () => {
      expect(
        resolveRawUrl('https://gist.github.com/user/abc123'),
      ).toBe('https://gist.githubusercontent.com/user/abc123/raw');
    });

    it('converts gist URL without user to raw', () => {
      expect(
        resolveRawUrl('https://gist.github.com/abc123'),
      ).toBe('https://gist.githubusercontent.com/abc123/raw');
    });

    it('handles trailing slash', () => {
      expect(
        resolveRawUrl('https://gist.github.com/user/abc123/'),
      ).toBe('https://gist.githubusercontent.com/user/abc123/raw');
    });
  });

  describe('already-raw GitHub URLs', () => {
    it('passes through raw.githubusercontent.com', () => {
      const url = 'https://raw.githubusercontent.com/user/repo/main/file.json';
      expect(resolveRawUrl(url)).toBe(url);
    });

    it('passes through gist.githubusercontent.com', () => {
      const url = 'https://gist.githubusercontent.com/user/abc123/raw';
      expect(resolveRawUrl(url)).toBe(url);
    });
  });

  describe('GitLab URLs', () => {
    it('converts a snippet URL to raw', () => {
      expect(
        resolveRawUrl('https://gitlab.com/-/snippets/5971408'),
      ).toBe('https://gitlab.com/-/snippets/5971408/raw');
    });

    it('converts a project snippet URL to raw', () => {
      expect(
        resolveRawUrl('https://gitlab.com/user/project/-/snippets/123'),
      ).toBe('https://gitlab.com/user/project/-/snippets/123/raw');
    });

    it('handles snippet URL with trailing slash', () => {
      expect(
        resolveRawUrl('https://gitlab.com/-/snippets/5971408/'),
      ).toBe('https://gitlab.com/-/snippets/5971408/raw');
    });

    it('passes through already-raw snippet URL', () => {
      const url = 'https://gitlab.com/-/snippets/5971408/raw';
      expect(resolveRawUrl(url)).toBe(url);
    });

    it('passes through snippet download URL with /raw/ path', () => {
      const url = 'https://gitlab.com/-/snippets/5971408/raw/main/file.json?inline=false';
      expect(resolveRawUrl(url)).toBe(url);
    });

    it('converts a blob URL to raw', () => {
      expect(
        resolveRawUrl('https://gitlab.com/user/project/-/blob/main/path/to/file.json'),
      ).toBe('https://gitlab.com/user/project/-/raw/main/path/to/file.json');
    });

    it('passes through other GitLab URLs unchanged', () => {
      const url = 'https://gitlab.com/user/project';
      expect(resolveRawUrl(url)).toBe(url);
    });
  });

  describe('other HTTPS URLs', () => {
    it('passes through any other HTTPS URL', () => {
      const url = 'https://example.com/session.json';
      expect(resolveRawUrl(url)).toBe(url);
    });
  });

  describe('error cases', () => {
    it('throws on non-HTTPS URLs', () => {
      expect(() => resolveRawUrl('http://example.com/file.json')).toThrow(
        'Only HTTPS URLs are supported',
      );
    });

    it('throws on ftp URLs', () => {
      expect(() => resolveRawUrl('ftp://example.com/file.json')).toThrow(
        'Only HTTPS URLs are supported',
      );
    });

    it('throws on invalid URLs', () => {
      expect(() => resolveRawUrl('not-a-url')).toThrow('Invalid URL');
    });

    it('throws on empty string', () => {
      expect(() => resolveRawUrl('')).toThrow('Invalid URL');
    });
  });
});

