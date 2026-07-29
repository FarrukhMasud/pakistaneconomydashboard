import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../../src/utils/escapeHtml.js';

test('escapeHtml escapes markup and quotes', () => {
  assert.equal(
    escapeHtml(`<script>alert("x")</script>&'`),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;',
  );
});

test('escapeHtml stringifies nullish values safely', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(12.5), '12.5');
});
