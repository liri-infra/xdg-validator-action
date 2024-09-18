// SPDX-FileCopyrightText: 2020-2024 Pier Luigi Fiorini <pierluigi.fiorini@liri.io>
//
// SPDX-License-Identifier: MIT

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as exec from '@actions/exec'
import * as glob from 'glob'

interface CommandError extends Error {
  message: string
}

async function runCommand(cmd: string, args: string[]): Promise<string> {
  let output = ''
  let error = ''

  const options: exec.ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      },
      stderr: (data: Buffer) => {
        error += data.toString()
      }
    }
  }

  try {
    await exec.exec(cmd, args, options)
    return output.trim()
  } catch (e) {
    throw new Error(error.trim()) as CommandError
  }
}

async function updateStatus(
  status: 'error' | 'failure' | 'pending' | 'success',
  descr: string
): Promise<void> {
  const validStatuses = ['error', 'failure', 'pending', 'success']
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Status can be one of ${validStatuses.join(', ')} not ${status}`
    )
  }

  const octokit = github.getOctokit(process.env.GITHUB_TOKEN!)
  const context = github.context

  await octokit.rest.repos.createCommitStatus({
    ...context.repo,
    sha: context.sha,
    state: status,
    target_url: 'https://github.com/liri-infra/xdg-validator-action',
    description: descr,
    context: 'status-check/xdg'
  })
}

async function listFiles(number: number): Promise<string[]> {
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN!)
  const context = github.context

  const { data: files } = await octokit.rest.pulls.listFiles({
    ...context.repo,
    pull_number: number
  })

  return files.map((file: { filename: any }) => file.filename)
}

async function validate(
  validator: 'appdata' | 'desktop',
  filename: string
): Promise<void> {
  const strict = core.getBooleanInput('strict')

  if (validator === 'appdata') {
    if (strict) {
      await runCommand('appstream-util', ['validate-strict', filename])
    } else {
      await runCommand('appstream-util', ['validate', filename])
    }
  } else if (validator === 'desktop') {
    await runCommand('desktop-file-validate', [filename])
  }
}

export async function action(): Promise<boolean> {
  const context = github.context
  const workspace = process.env.GITHUB_WORKSPACE!

  process.chdir(workspace)

  await updateStatus('pending', 'Validating XDG files...')

  let filenames: string[] = []

  if (context.payload.pull_request) {
    filenames = await listFiles(context.payload.pull_request.number)
  } else {
    filenames = [...glob.sync('**/*.appdata.xml'), ...glob.sync('**/*.desktop')]
  }

  const errorFilenames: string[] = []

  for (const filename of filenames) {
    try {
      await updateStatus('pending', `Checking ${filename}...`)
      core.debug(`Checking ${filename}...`)

      if (filename.endsWith('.appdata.xml')) {
        await validate('appdata', filename)
      } else if (filename.endsWith('.desktop')) {
        await validate('desktop', filename)
      }
    } catch (e) {
      if (e instanceof Error) {
        e.message.split('\n').forEach(line => {
          core.error(line.trim(), { file: filename })
        })
        errorFilenames.push(filename)
      }
    }
  }

  if (errorFilenames.length > 0) {
    await updateStatus('failure', 'One or more XDG files are not valid')
    return false
  } else {
    await updateStatus('success', 'XDG files are valid')
    return true
  }
}
