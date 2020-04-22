# xdg-validator-action

Validates freedesktop.org files in a pull request, such as:

 * Desktop file entries
 * AppStream metadata

## Example usage

```yaml
uses: liri-infra/xdg-validator-action@master
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
