import { describe, expect, it, vi } from 'vitest'
import { GitHubConflictError, githubClient } from '../../api/_lib/github'

describe('githubClient (REST contents API)', () => {
  it('getFile: GET on main with Bearer token, base64 decoded (with newlines)', async () => {
    const text = '{"é":1}\n'
    const b64 = Buffer.from(text).toString('base64').replace(/(.{4})/g, '$1\n')
    const fetch = vi.fn(async () => Response.json({ content: b64, sha: 'abc', encoding: 'base64' }))
    const r = await githubClient('tok', 'adimby/cashretrait', fetch).getFile('public/tarifs.json')
    expect(r).toEqual({ content: text, sha: 'abc' })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.github.com/repos/adimby/cashretrait/contents/public/tarifs.json?ref=main')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok')
  })
  it('putFile: PUT with base64 content, sha, branch main → commit url', async () => {
    const fetch = vi.fn(async () => Response.json({ commit: { html_url: 'https://github.com/c/1' } }, { status: 200 }))
    const r = await githubClient('tok', 'a/b', fetch).putFile('public/tarifs.json', 'héllo', 's1', 'msg')
    expect(r).toEqual({ commitUrl: 'https://github.com/c/1' })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.github.com/repos/a/b/contents/public/tarifs.json')
    expect(init.method).toBe('PUT')
    const body = JSON.parse(String(init.body))
    expect(body).toEqual({ message: 'msg', content: Buffer.from('héllo').toString('base64'), sha: 's1', branch: 'main' })
  })
  it('putFile: 409 → GitHubConflictError', async () => {
    const fetch = vi.fn(async () => Response.json({ message: 'is at x but expected y' }, { status: 409 }))
    await expect(githubClient('tok', 'a/b', fetch).putFile('p', 'c', 's', 'm')).rejects.toBeInstanceOf(GitHubConflictError)
  })
  it('other errors throw with the status', async () => {
    const fetch = vi.fn(async () => new Response('nope', { status: 401 }))
    await expect(githubClient('tok', 'a/b', fetch).getFile('p')).rejects.toThrow(/401/)
  })
  it('rejects a malformed repo name', () => {
    expect(() => githubClient('tok', 'a/b/../c', fetch)).toThrow()
  })
})
