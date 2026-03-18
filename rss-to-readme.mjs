import { readFile, writeFile } from 'node:fs/promises';
import { extract } from '@extractus/feed-extractor';

// Constants
const README_PATH = './README.md';
const RSS_URL = 'https://romantech.net/rss';

const MAX_POSTS = 5;
const HEADER_PREFIX = '##';
const LINKS_HEADER = `${HEADER_PREFIX} 🔗 Links`;
const POSTS_HEADER = `${HEADER_PREFIX} 📝 Articles`;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const POSTS_REGEX = new RegExp(
  `${escapeRegex(POSTS_HEADER)}[\\s\\S]*?(?=\\n${escapeRegex(HEADER_PREFIX)}|$)`,
);

const convertToHTTPS = (url) => url.replace(/^http:/i, 'https:');

const createPostsMarkdown = (entries, count) => {
  const posts = entries
    .filter((entry) => entry?.title && entry?.link)
    .slice(0, count)
    .map(({ title, link }) => `- [${title}](${convertToHTTPS(link)})`);

  return [POSTS_HEADER, ...posts].join('\n');
};

const updateReadme = (content, newPosts) => {
  const hasPosts = content.includes(POSTS_HEADER);

  if (hasPosts) {
    return content.replace(POSTS_REGEX, `${newPosts}\n`);
  }

  const linksIndex = content.indexOf(LINKS_HEADER);
  if (linksIndex !== -1) {
    const beforeLinks = content.slice(0, linksIndex).replace(/\s*$/, '\n\n');
    const linksSection = content.slice(linksIndex).replace(/^\s*/, '');
    return `${beforeLinks}${newPosts}\n\n${linksSection}`;
  }

  return `${content.replace(/\s*$/, '\n\n')}${newPosts}\n`;
};

const refreshReadme = async () => {
  const feed = await extract(RSS_URL, {
    xmlParserOptions: {
      processEntities: false,
    },
  });

  const entries = feed?.entries ?? [];

  if (entries.length === 0) {
    console.log('No entries found in feed.');
    return;
  }

  const readme = await readFile(README_PATH, 'utf8');
  const newPosts = createPostsMarkdown(entries, MAX_POSTS);
  const updatedReadme = updateReadme(readme, newPosts);

  if (updatedReadme !== readme) {
    await writeFile(README_PATH, updatedReadme, 'utf8');
    console.log('README.md updated successfully');
  } else {
    console.log('No new blog posts. README.md was not updated.');
  }
};

try {
  await refreshReadme();
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`Error: README.md file not found at ${README_PATH}`);
  } else {
    console.error('Error during the refresh process:', error);
  }
  process.exit(1);
}
