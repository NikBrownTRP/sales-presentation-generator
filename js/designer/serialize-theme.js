/*
 * serialize-theme.js
 * Given the original CSS string and a map of edits, produce an updated CSS
 * string with only the changed variable values rewritten in place.
 *
 * Edits format:
 *   { 'trp-dark': { '--pres-accent': '#ff0000' }, 'tektro-light': { ... } }
 *
 * Strategy: parse each named theme block, collect (valueStart, valueEnd,
 * newValue) tuples for any changed declarations, sort by valueStart
 * descending, then splice each into the source string. Working in reverse
 * order keeps earlier offsets valid as later substrings shrink/grow.
 *
 * Unedited declarations and any other CSS (selectors, comments, other rules)
 * are left byte-for-byte intact.
 */
(function () {
  'use strict';

  function serialize(css, edits) {
    var themes = Object.keys(edits);
    var splices = [];
    for (var i = 0; i < themes.length; i++) {
      var theme = themes[i];
      var parsed = window.DesignerParseTheme.parseTheme(css, theme);
      if (!parsed) {
        throw new Error('Theme not found in CSS: ' + theme);
      }
      var changes = edits[theme] || {};
      var tokens = Object.keys(changes);
      for (var t = 0; t < tokens.length; t++) {
        var token = tokens[t];
        var decl = parsed.vars[token];
        if (!decl) {
          // Skip silently: editor offered no value to write back. If we
          // want to support adding NEW variables later, this is where it
          // would happen.
          continue;
        }
        var newValue = String(changes[token]);
        if (newValue === decl.value) continue; // no-op
        splices.push({
          start: decl.valueStart,
          end: decl.valueEnd,
          text: newValue
        });
      }
    }

    splices.sort(function (a, b) { return b.start - a.start; });

    var out = css;
    for (var s = 0; s < splices.length; s++) {
      var sp = splices[s];
      out = out.slice(0, sp.start) + sp.text + out.slice(sp.end);
    }
    return out;
  }

  window.DesignerSerializeTheme = { serialize: serialize };
})();
