// @flow
/**
 * This component, given a set of DOMHighlights, draws highlight rectangles in
 * the same absolute position as the highlighted content, as computed by the
 * range's `getClientRects` method.
 *
 * TODO(mdr): Many things can affect the correct positioning of highlighting,
 *     and this component does not attempt to anticipate them. If we start
 *     using this highlighting library on content with a more dynamic layout,
 *     we should add a hook to allow the parent to `forceUpdate` the
 *     `HighlightingUI`.
 */
const React = require("react");

const HighlightRenderer = require("./highlight-renderer.jsx");
const HighlightTooltip = require("./highlight-tooltip.jsx");
const SelectionTracker = require("./selection-tracker.jsx");

import type {DOMHighlight, DOMHighlightSet, DOMRange, Position, ZIndexes}
    from "./types.js";

/* global i18n */

type HighlightingUIProps = {
    // A function that builds a DOMHighlight from the given DOMRange, if
    // possible. If it would not currently be valid to add a highlight over the
    // given DOMRange, returns null.
    buildHighlight: (range: DOMRange) => ?DOMHighlight,

    // Whether the highlights are user-editable. If false, highlights are
    // read-only.
    editable: boolean,

    // A set of highlights to render.
    highlights: DOMHighlightSet,

    // This component's `offsetParent` element, which is the nearest ancestor
    // with `position: relative`. This will enable us to choose the correct
    // CSS coordinates to align highlights and tooltips with the target
    // content.
    offsetParent: Element,

    // A callback indicating that the user would like to add the given
    // highlight to the current set of highlights.
    onAddHighlight: (range: DOMHighlight) => mixed,

    // A callback indicating that the user would like to remove the highlight
    // with the given key.
    onRemoveHighlight: (highlightKey: string) => mixed,

    // The z-indexes to use when rendering tooltips above content, and
    // highlights below content.
    zIndexes: ZIndexes,
};

type HighlightingUIState = {
    // The mouse's position relative to the viewport, as of the most recent
    // global `mousemove` event. Passed to each `SingleHighlightRenderer` that
    // this component renders.
    mouseClientPosition: ?Position,
};

class HighlightingUI extends React.PureComponent {
    /* eslint-disable react/sort-comp */
    props: HighlightingUIProps
    state: HighlightingUIState = {
        mouseClientPosition: null,
    }
    /* eslint-enable react/sort-comp */

    componentDidMount() {
        this._updateEditListeners(false, this.props.editable);
    }

    componentWillReceiveProps(nextProps: HighlightingUIProps) {
        this._updateEditListeners(this.props.editable, nextProps.editable);
    }

    componentWillUnmount() {
        this._updateEditListeners(this.props.editable, false);
    }

    /**
     * Given whether we were previously listening to mousemove events, and
     * whether we will now listen to mousemove events, add or remove the
     * listener accordingly.
     */
    _updateEditListeners(wasListening: boolean, willListen: boolean) {
        if (!wasListening && willListen) {
            window.addEventListener("mousemove", this._handleMouseMove);
        } else if (wasListening && !willListen) {
            window.removeEventListener("mousemove", this._handleMouseMove);

            // Additionally, reset the mouse position. Our child components
            // won't be checking `mouseClientPosition` when we're not
            // listening, anyway, but this guards against errors where we
            // re-enter listening mode and have stale coordinates stored in
            // state.
            this.setState({
                mouseClientPosition: null,
            });
        }
    }

    _handleMouseMove = (e: MouseEvent) => {
        this.setState({
            mouseClientPosition: {
                left: e.clientX,
                top: e.clientY,
            },
        });
    }

    _handleAddHighlight(highlightToAdd: DOMHighlight) {
        this.props.onAddHighlight(highlightToAdd);

        // Deselect the newly-highlighted text, by collapsing the selection
        // to the end of the range.
        const selection = document.getSelection();
        if (selection) {
            selection.collapseToEnd();
        }
    }

    render() {
        return <SelectionTracker
            buildHighlight={this.props.buildHighlight}
            enabled={this.props.editable}
        >
            {(trackedSelection, userIsMouseSelecting) =>
                <div>
                    {Object.keys(this.props.highlights).map(key =>
                        <HighlightRenderer
                            editable={
                                /* An existing highlight is editable when the
                                 * component is in editable mode, and there's
                                 * not a selection and "Add highlight" tooltip
                                 * taking precedence over it. */
                                this.props.editable && !trackedSelection}
                            key={key}
                            highlight={this.props.highlights[key]}
                            highlightKey={key}
                            mouseClientPosition={this.state.mouseClientPosition}
                            offsetParent={this.props.offsetParent}
                            onRemoveHighlight={this.props.onRemoveHighlight}
                            zIndexes={this.props.zIndexes}
                        />
                    )}
                    {trackedSelection && !userIsMouseSelecting &&
                        <HighlightTooltip
                            label={i18n._("Add highlight")}
                            onClick={() => this._handleAddHighlight(
                                trackedSelection.proposedHighlight)}

                            focusNode={trackedSelection.focusNode}
                            focusOffset={trackedSelection.focusOffset}
                            offsetParent={this.props.offsetParent}
                            zIndex={this.props.zIndexes.aboveContent}
                        />
                    }
                </div>
            }
        </SelectionTracker>;
    }
}

module.exports = HighlightingUI;
