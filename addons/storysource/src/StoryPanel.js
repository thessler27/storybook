import React, { Component } from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { Editor } from '@storybook/components';
import { document } from 'global';
import { FileExplorer, BrowserPreview, SandpackProvider } from 'react-smooshpack';
import Draggable from 'react-draggable';
import { SAVE_FILE_EVENT_ID, STORY_EVENT_ID } from './events';

const getLocationKeys = locationsMap =>
  locationsMap
    ? Array.from(Object.keys(locationsMap)).sort(
        (key1, key2) => locationsMap[key1].startLoc.line - locationsMap[key2].startLoc.line
      )
    : [];

export default class StoryPanel extends Component {
  state = {
    source: '// 🦄 Looking for it, hold on tight',
    lineDecorations: [],
    additionalStyles: css`
      background-color: #c6ff0040;
    `,
  };

  componentDidMount() {
    const { channel } = this.props;

    channel.on(STORY_EVENT_ID, this.listener);
  }

  componentWillUnmount() {
    const { channel } = this.props;

    channel.removeListener(STORY_EVENT_ID, this.listener);
  }

  listener = ({
    fileName,
    source,
    currentLocation,
    locationsMap,
    dependencies,
    localDependencies,
  }) => {
    const locationsKeys = getLocationKeys(locationsMap);

    this.setState({
      fileName,
      source,
      dependencies,
      localDependencies,
      currentLocation,
      locationsMap, // eslint-disable-line react/no-unused-state
      locationsKeys, // eslint-disable-line react/no-unused-state
    });

    console.log({
      fileName,
      source,
      currentLocation,
      locationsMap,
      dependencies,
      localDependencies,
    });
  };

  editorDidMount = (editor, monaco) => {
    editor.addAction({
      id: 'save-the-selected-story-in-source-file',
      label: '🇸 Save the selected story in source file',
      keybindings: [
        // eslint-disable-next-line no-bitwise
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S,
        // chord
        monaco.KeyMod.chord(
          // eslint-disable-next-line no-bitwise
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_X,
          // eslint-disable-next-line no-bitwise
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S
        ),
      ],
      precondition: null,
      keybindingContext: null,
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: thisEditor => {
        const { fileName } = this.state;
        const { channel } = this.props;
        const content = thisEditor.getModel().getValue();
        channel.emit(SAVE_FILE_EVENT_ID, {
          fileName,
          content,
        });
        return null;
      },
    });
  };

  onStoryRendered = editor => {
    const {
      currentLocation: {
        startLoc: { line: startLocLine },
      },
    } = this.state;
    // eslint-disable-next-line no-underscore-dangle
    editor._revealLine(startLocLine);
    // eslint-disable-next-line no-underscore-dangle
    editor._actions['editor.action.jumpToBracket']._run();
  };

  updateSource = (
    newSource,
    {
      changes: [
        {
          range: { startLineNumber, endLineNumber, endColumn, startColumn },
          text,
        },
      ],
    }
  ) => {
    const {
      currentLocation: {
        startLoc: { line: startLocLine, col: startLocCol },
        endLoc: { line: endLocLine, col: endLocCol },
      },
    } = this.state;

    const newEndLocLine =
      endLocLine -
      (endLineNumber - startLineNumber) /* selection range cut */ +
      text.split('').filter(x => x === '\n')
        .length; /* all the line feeds in the replacement text */
    let newEndLocCol;
    if (endLineNumber < endLocLine) {
      /* edge column not moving if change occuring above */
      newEndLocCol = endLocCol;
    } else if (startLineNumber === endLineNumber && text.indexOf('\n') === -1) {
      /* new character typed / removed */
      newEndLocCol = endLocCol + text.length - (endColumn - startColumn);
    } else {
      /* the last line was probably merged with the previous one(s) */
      newEndLocCol = newSource.split('\n')[newEndLocLine - 1].length - 1;
    }

    this.setState({
      source: newSource,
      currentLocation: {
        startLoc: { line: startLocLine, col: startLocCol },
        endLoc: { line: newEndLocLine, col: newEndLocCol },
      },
    });
  };

  handleFileExplorerResize = (e, { x }) => {
    this.setState({ fileExplorerWidth: x });
  };

  changePosition = (e, editor, monaco) => {
    const {
      additionalStyles,
      lineDecorations,
      currentLocation: { startLoc, endLoc },
    } = this.state;
    const highlightClassName = `css-${additionalStyles.name}`;
    // probably a bug in monaco editor.
    // we will prevent the first highlighting from gluing in the editor
    const allDecorations = (lineDecorations || [])
      // eslint-disable-next-line no-underscore-dangle
      .concat(Object.keys(editor._modelData.viewModel.decorations._decorationsCache));
    const newLineDecorations = editor.deltaDecorations(allDecorations, [
      {
        range: new monaco.Range(startLoc.line, startLoc.col + 1, endLoc.line, endLoc.col + 1),
        options: { isWholeLine: false, inlineClassName: highlightClassName },
      },
    ]);

    if (
      e.position.lineNumber < startLoc.line ||
      (e.position.lineNumber === startLoc.line && e.position.column < startLoc.col)
    )
      editor.setPosition({
        lineNumber: startLoc.line,
        column: startLoc.col,
      });
    if (
      e.position.lineNumber > endLoc.line ||
      (e.position.lineNumber === endLoc.line && e.position.column > endLoc.col + 1)
    )
      editor.setPosition({
        lineNumber: endLoc.line,
        column: endLoc.col + 1,
      });

    if (newLineDecorations[0] !== lineDecorations[0])
      this.setState({ lineDecorations: newLineDecorations });
  };

  render = () => {
    const { channel, active } = this.props;
    const {
      source,
      additionalStyles,
      dependencies,
      localDependencies,
      fileExplorerWidth,
    } = this.state;
    return active ? (
      <SandpackProvider
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}
        files={{ ...localDependencies, '/index.js': { code: source } }}
        dependencies={Object.assign({}, ...(dependencies || []).map(d => ({ [d]: 'latest' })))}
        entry="/index.js"
      >
        <div
          style={{
            fontFamily: 'Helvetica, sans-serif',
            boxSizing: 'border-box',
            backgroundColor: '#24282a',
            color: 'white',
            paddingTop: '0.5em',
            minWidth: `${fileExplorerWidth || 127}px`,
          }}
        >
          <FileExplorer />
        </div>
        <Draggable
          axis="x"
          style={{ flex: 1 }}
          bounds={{ left: 127 }}
          defaultPosition={{ x: fileExplorerWidth || 127, y: 0 }}
          onDrag={this.handleFileExplorerResize}
          onDragEnd={this.handleFileExplorerResize}
        >
          <div
            style={{
              zIndex: 10,
              width: '5',
              height: '100%',
              position: 'absolute',
              cursor: 'col-resize',
            }}
          >
            &nbsp;
          </div>
        </Draggable>
        <div
          css={css`
            flex: 1;
            width: 100%;
            height: 100%;
          `}
        >
          <Editor
            css={additionalStyles}
            source={source}
            onChange={this.updateSource}
            componentDidMount={this.editorDidMount}
            changePosition={this.changePosition}
            onStoryRendered={this.onStoryRendered}
            channel={channel}
            resizeContainerReference={() =>
              (document.getElementById('storybook-panel-root') || {}).parentNode
            }
          />
        </div>
        <BrowserPreview
          className={css`
            align-items: center;
            background-color: whitesmoke;
            padding: 0.5rem;
            border-radius: 2px;
            border-bottom: 1px solid #ddd;
          `}
        />
      </SandpackProvider>
    ) : null;
  };
}

StoryPanel.propTypes = {
  active: PropTypes.bool.isRequired,
  api: PropTypes.shape({
    selectStory: PropTypes.func.isRequired,
  }).isRequired,
  channel: PropTypes.shape({
    emit: PropTypes.func,
    on: PropTypes.func,
    removeListener: PropTypes.func,
  }).isRequired,
};
