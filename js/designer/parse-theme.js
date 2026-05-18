/*
 * parse-theme.js
 * Extracts the per-theme CSS variable declarations from slides.css.
 *
 * For each theme name we locate the FIRST rule of the form:
 *     [data-theme="<name>"] { ... }
 * (selector must be exactly that — no descendant or compound selectors).
 * Then we parse `--token: value;` declarations inside that block,
 * recording the byte offsets of the value so a serializer can do
 * surgical, in-place replacements.
 */
(function () {
  'use strict';

  function findThemeBlock(css, theme) {
    var needle = '[data-theme="' + theme + '"]';
    var searchFrom = 0;
    while (true) {
      var idx = css.indexOf(needle, searchFrom);
      if (idx === -1) return null;
      var j = idx + needle.length;
      while (j < css.length && /\s/.test(css[j])) j++;
      if (css[j] === '{') {
        var end = css.indexOf('}', j + 1);
        if (end === -1) return null;
        return { ruleStart: idx, blockStart: j, blockEnd: end };
      }
      searchFrom = idx + needle.length;
    }
  }

  function parseDeclarations(css, blockStart, blockEnd) {
    var inner = css.slice(blockStart + 1, blockEnd);
    var decls = {};
    var declRe = /(--[A-Za-z0-9_-]+)\s*:\s*([^;]+?)\s*;/g;
    var m;
    while ((m = declRe.exec(inner)) !== null) {
      var token = m[1];
      var value = m[2];
      var matchStart = blockStart + 1 + m.index;
      var colonIdx = css.indexOf(':', matchStart);
      var vs = colonIdx + 1;
      while (vs < css.length && /\s/.test(css[vs])) vs++;
      var ve = vs + value.length;
      decls[token] = { value: value, valueStart: vs, valueEnd: ve };
    }
    return decls;
  }

  function parseTheme(css, theme) {
    var block = findThemeBlock(css, theme);
    if (!block) return null;
    return {
      theme: theme,
      blockStart: block.blockStart,
      blockEnd: block.blockEnd,
      vars: parseDeclarations(css, block.blockStart, block.blockEnd)
    };
  }

  function parseAllThemes(css, themes) {
    var out = {};
    for (var i = 0; i < themes.length; i++) {
      out[themes[i]] = parseTheme(css, themes[i]);
    }
    return out;
  }

  window.DesignerParseTheme = {
    parseTheme: parseTheme,
    parseAllThemes: parseAllThemes
  };
})();
