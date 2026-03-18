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

const getValidEntries = (entries) => entries.filter((entry) => entry?.title && entry?.link);

const createPostsMarkdown = (entries, count) => {
  const posts = getValidEntries(entries)
    .slice(0, count)
    .map(({ title, link }) => `- [${title}](${convertToHTTPS(link)})`);

  return [POSTS_HEADER, ...posts].join('\n');
};

const extractCurrentPostLinks = (content) => {
  const match = content.match(POSTS_REGEX);

  if (!match) {
    return [];
  }

  return match[0]
    .split('\n')
    .slice(1)
    .map((line) => line.match(/^- \[(.+?)\]\((.+?)\)$/)?.[2]?.trim())
    .filter(Boolean)
    .map(convertToHTTPS);
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

const setGitHubOutputs = async (addedEntries) => {
  const githubOutput = process.env.GITHUB_OUTPUT;

  if (!githubOutput) {
    return;
  }

  const addedCount = String(addedEntries.length);
  const addedLinksBody =
    addedEntries.length > 0
      ? addedEntries.map(({ link }) => `- ${convertToHTTPS(link)}`).join('\n')
      : '- None';

  await writeFile(
    githubOutput,
    [`added_count=${addedCount}`, 'added_links<<EOF', addedLinksBody, 'EOF'].join('\n') + '\n',
    { encoding: 'utf8', flag: 'a' },
  );
};

const refreshReadme = async () => {
  const feed = await extract(RSS_URL, {
    xmlParserOptions: {
      processEntities: false,
    },
  });

  const entries = feed?.entries ?? [];
  const validEntries = getValidEntries(entries);

  if (validEntries.length === 0) {
    console.log('No entries found in feed.');
    await setGitHubOutputs([]);
    return;
  }

  const readme = await readFile(README_PATH, 'utf8');
  const previousLinks = extractCurrentPostLinks(readme);
  const newPosts = createPostsMarkdown(validEntries, MAX_POSTS);
  const updatedReadme = updateReadme(readme, newPosts);

  const nextEntries = validEntries.slice(0, MAX_POSTS);
  const addedEntries = nextEntries.filter(
    ({ link }) => !previousLinks.includes(convertToHTTPS(link)),
  );

  await setGitHubOutputs(addedEntries);

  if (updatedReadme !== readme) {
    await writeFile(README_PATH, updatedReadme, 'utf8');
    console.log('README.md updated successfully');
    console.log(`Newly added posts: ${addedEntries.length}`);
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
