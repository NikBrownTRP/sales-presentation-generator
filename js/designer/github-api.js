/*
 * github-api.js
 * Thin wrapper around the GitHub Contents API.
 *
 * Auth: Personal Access Token stored in localStorage["pb_gh_pat"].
 * Repo target: localStorage["pb_gh_repo"] in "owner/name" form.
 * Branch:     localStorage["pb_gh_branch"] or defaults to "main".
 *
 * All network calls target https://api.github.com directly. No backend.
 */
(function () {
  'use strict';

  var API = 'https://api.github.com';

  function getConfig() {
    return {
      token: localStorage.getItem('pb_gh_pat') || '',
      repo: localStorage.getItem('pb_gh_repo') || '',
      branch: localStorage.getItem('pb_gh_branch') || 'main'
    };
  }

  function setConfig(cfg) {
    if (cfg.token !== undefined) localStorage.setItem('pb_gh_pat', cfg.token);
    if (cfg.repo !== undefined) localStorage.setItem('pb_gh_repo', cfg.repo);
    if (cfg.branch !== undefined) localStorage.setItem('pb_gh_branch', cfg.branch);
  }

  function clearToken() { localStorage.removeItem('pb_gh_pat'); }

  function headers(token) {
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function ensureReady(cfg) {
    if (!cfg.token) throw new Error('No GitHub token configured.');
    if (!cfg.repo || cfg.repo.indexOf('/') === -1) {
      throw new Error('GitHub repo not configured (expected "owner/name").');
    }
  }

  // Base64 helpers — robust to non-ASCII text and to binary (Uint8Array) payloads.
  function utf8ToBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function base64ToUtf8(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function bytesToBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function getFile(path) {
    var cfg = getConfig();
    ensureReady(cfg);
    var url = API + '/repos/' + cfg.repo + '/contents/' + encodeURI(path) +
      '?ref=' + encodeURIComponent(cfg.branch);
    return fetch(url, { headers: headers(cfg.token) }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('GitHub GET ' + path + ' failed: ' + r.status + ' ' + t); });
      return r.json();
    }).then(function (json) {
      return {
        sha: json.sha,
        content: base64ToUtf8(json.content || ''),
        raw: json
      };
    });
  }

  function putFile(path, content, sha, message) {
    var cfg = getConfig();
    ensureReady(cfg);
    var url = API + '/repos/' + cfg.repo + '/contents/' + encodeURI(path);
    var body = {
      message: message || ('chore(theme): update ' + path),
      content: utf8ToBase64(content),
      branch: cfg.branch
    };
    if (sha) body.sha = sha;
    return fetch(url, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers(cfg.token)),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('GitHub PUT ' + path + ' failed: ' + r.status + ' ' + t); });
      return r.json();
    });
  }

  // For binary uploads (logos). bytes is a Uint8Array.
  function putBinary(path, bytes, sha, message) {
    var cfg = getConfig();
    ensureReady(cfg);
    var url = API + '/repos/' + cfg.repo + '/contents/' + encodeURI(path);
    var body = {
      message: message || ('chore(theme): update ' + path),
      content: bytesToBase64(bytes),
      branch: cfg.branch
    };
    if (sha) body.sha = sha;
    return fetch(url, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers(cfg.token)),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('GitHub PUT (binary) ' + path + ' failed: ' + r.status + ' ' + t); });
      return r.json();
    });
  }

  // Probe so the UI can show "connected to owner/repo" or surface auth errors early.
  function verifyAccess() {
    var cfg = getConfig();
    ensureReady(cfg);
    return fetch(API + '/repos/' + cfg.repo, { headers: headers(cfg.token) }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('Cannot access ' + cfg.repo + ': ' + r.status + ' ' + t); });
      return r.json();
    });
  }

  window.DesignerGitHubAPI = {
    getConfig: getConfig,
    setConfig: setConfig,
    clearToken: clearToken,
    getFile: getFile,
    putFile: putFile,
    putBinary: putBinary,
    verifyAccess: verifyAccess
  };
})();
