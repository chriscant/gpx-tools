# gpx-tools
Tool to normalise GPX files

## Usage

`node merge-gpx.js <config.json>`

where `config.json` specifies the input, output and options.

```
{
  "outputFolder": "normalised",
  "outputFile": "merged",
  "includeTracks": false,
  "includePoints": true,
  "input": {
    "gpx": "pathto/*.gpx",
  }
}```
