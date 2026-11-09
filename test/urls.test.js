import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFigmaHost, isWorkUrl, isLoginUrl, isHomeUrl } from '../urls.js';

const classify = (url) => ({
  figma: isFigmaHost(url),
  work: isWorkUrl(url),
  login: isLoginUrl(url),
  home: isHomeUrl(url),
});

test('work URLs', () => {
  const urls = [
    'https://www.figma.com/design/AbC123/My-File?node-id=1-2&t=xyz',
    'https://www.figma.com/file/AbC123/Old',
    'https://www.figma.com/board/X/Y',
    'https://www.figma.com/proto/X/Y?node-id=3-4',
    'https://www.figma.com/slides/X/Y',
    'https://www.figma.com/site/X/Y',
    'https://www.figma.com/make/X/Y',
    'https://www.figma.com/deck/X/Y',
    'https://figma.com/design/AbC123/My-File',
  ];
  for (const url of urls) {
    assert.deepEqual(classify(url), { figma: true, work: true, login: false, home: false }, url);
  }
});

test('login URLs', () => {
  const urls = [
    'https://www.figma.com/login?locale=en&cont=%2Ffiles',
    'https://www.figma.com/login',
    'https://www.figma.com/signup',
    'https://www.figma.com/logout',
    'https://www.figma.com/sso',
    'https://www.figma.com/login_sso?email=a%40b.c',
    'https://www.figma.com/auth/callback',
    'https://figma.com/login',
  ];
  for (const url of urls) {
    assert.deepEqual(classify(url), { figma: true, work: false, login: true, home: false }, url);
  }
});

test('home URLs', () => {
  const urls = [
    'https://www.figma.com/files/recents',
    'https://www.figma.com/files/team/123',
    'https://www.figma.com/files/project/456/Name',
    'https://www.figma.com/files',
    'https://www.figma.com/files/',
    'https://www.figma.com/',
    'https://www.figma.com',
    'https://figma.com/',
  ];
  for (const url of urls) {
    assert.deepEqual(classify(url), { figma: true, work: false, login: false, home: true }, url);
  }
});

test('/files/ is home, not work (does not match /file/)', () => {
  assert.equal(isWorkUrl('https://www.figma.com/files/recents'), false);
  assert.equal(isHomeUrl('https://www.figma.com/file/AbC/Name'), false);
});

test('non-Figma URLs match nothing', () => {
  const urls = [
    'https://accounts.google.com/o/oauth2/auth?client_id=x&redirect_uri=https://www.figma.com/',
    'https://accounts.google.com/signin',
    'https://evil.com/design/AbC/X',
    'https://figma.com.evil.com/design/AbC/X',
    'https://help.figma.com/hc/en-us',
    'ftp://www.figma.com/design/AbC/X',
  ];
  for (const url of urls) {
    assert.deepEqual(classify(url), { figma: false, work: false, login: false, home: false }, url);
  }
});

test('other Figma pages are Figma but none of work/login/home', () => {
  assert.deepEqual(classify('https://www.figma.com/community/file/123'), {
    figma: true,
    work: false,
    login: false,
    home: false,
  });
});

test('invalid input returns false and never throws', () => {
  const inputs = ['', 'not a url', undefined, null, 42, {}, [], '://', 'https://'];
  for (const input of inputs) {
    for (const fn of [isFigmaHost, isWorkUrl, isLoginUrl, isHomeUrl]) {
      assert.doesNotThrow(() => fn(input));
      assert.equal(fn(input), false, `${fn.name}(${String(input)})`);
    }
  }
});
