import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { searchKeymap, openSearchPanel } from '@codemirror/search';
import { indentWithTab, undo, redo } from '@codemirror/commands';
import { oneDarkTheme } from '@codemirror/theme-one-dark';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { setDiagnostics } from '@codemirror/lint';

export function createEditor(parent, initialValue, onChange) {
  const makeState = (doc) =>
    EditorState.create({
      doc,
      extensions: [
        basicSetup,
        python(),
        oneDarkTheme,
        EditorView.theme({
          '.cm-gutters': { color: '#b3bac6' },
          '.cm-activeLineGutter': { color: '#ffffff' },
        }),
        syntaxHighlighting(
          HighlightStyle.define([
            { tag: tags.keyword, color: '#dbb8ff' },
            { tag: [tags.variableName, tags.propertyName], color: '#f2c6cb' },
            { tag: [tags.string, tags.special(tags.string)], color: '#b5e3a1' },
            { tag: [tags.number, tags.bool, tags.null], color: '#ffd39b' },
            {
              tag: [tags.function(tags.variableName), tags.typeName],
              color: '#9dd9ff',
            },
            { tag: tags.comment, color: '#b3bac6', fontStyle: 'italic' },
            { tag: [tags.operator, tags.punctuation], color: '#d8dee9' },
          ]),
        ),
        autocompletion(),
        keymap.of([indentWithTab, ...completionKeymap, ...searchKeymap]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': 'Python code editor',
          'aria-multiline': 'true',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
    });
  const view = new EditorView({ state: makeState(initialValue), parent });
  view.scrollDOM.tabIndex = 0;
  view.scrollDOM.setAttribute('aria-label', 'Scrollable Python editor');
  return {
    getValue: () => view.state.doc.toString(),
    setValue(value) {
      view.setState(makeState(value));
    },
    undo: () => {
      undo(view);
      view.focus();
    },
    redo: () => {
      redo(view);
      view.focus();
    },
    search: () => openSearchPanel(view),
    focus: () => view.focus(),
    clearErrors: () => view.dispatch(setDiagnostics(view.state, [])),
    showError(message) {
      const matches = [...message.matchAll(/line (\d+)/g)];
      const lineNumber = Number(matches.at(-1)?.[1] || 1);
      const line = view.state.doc.line(
        Math.min(Math.max(1, lineNumber), view.state.doc.lines),
      );
      view.dispatch(
        setDiagnostics(view.state, [
          {
            from: line.from,
            to: line.to,
            severity: 'error',
            message: message.trim().split('\n').at(-1),
          },
        ]),
      );
    },
    destroy: () => view.destroy(),
  };
}
