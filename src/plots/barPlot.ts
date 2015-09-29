///<reference path="../reference.ts" />

module Plottable {

type LabelConfig = {
  labelArea: d3.Selection<void>;
  measurer: SVGTypewriter.Measurers.Measurer;
  writer: SVGTypewriter.Writers.Writer;
};

export module Plots {
  export class Bar<X, Y> extends XYPlot<X, Y> {
    public static ORIENTATION_VERTICAL = "vertical";
    public static ORIENTATION_HORIZONTAL = "horizontal";
    private static _BAR_WIDTH_RATIO = 0.95;
    private static _SINGLE_BAR_DIMENSION_RATIO = 0.4;
    private static _BAR_AREA_CLASS = "bar-area";
    private static _LABEL_AREA_CLASS = "bar-label-text-area";
    private static _LABEL_VERTICAL_PADDING = 5;
    private static _LABEL_HORIZONTAL_PADDING = 5;
    private _baseline: d3.Selection<void>;
    private _baselineValue: X|Y;
    protected _isVertical: boolean;
    private _labelFormatter: Formatter = Formatters.identity();
    private _labelsEnabled = false;
    private _hideBarsIfAnyAreTooWide = true;
    private _labelConfig: Utils.Map<Dataset, LabelConfig>;
    private _baselineValueProvider: () => (X|Y)[];

    private _barPixelWidth = 0;
    private _updateBarPixelWidthCallback: () => void;

    /**
     * A Bar Plot draws bars growing out from a baseline to some value
     *
     * @constructor
     * @param {string} [orientation="vertical"] One of "vertical"/"horizontal".
     */
    constructor(orientation = Bar.ORIENTATION_VERTICAL) {
      super();
      this.addClass("bar-plot");
      if (orientation !== Bar.ORIENTATION_VERTICAL && orientation !== Bar.ORIENTATION_HORIZONTAL) {
        throw new Error(orientation + " is not a valid orientation for Plots.Bar");
      }
      this._isVertical = orientation === Bar.ORIENTATION_VERTICAL;
      this.animator("baseline", new Animators.Null());
      this.attr("fill", new Scales.Color().range()[0]);
      this.attr("width", () => this._barPixelWidth);
      this._labelConfig = new Utils.Map<Dataset, LabelConfig>();
      this._baselineValueProvider = () => [this.baselineValue()];
      this._updateBarPixelWidthCallback = () => this._updateBarPixelWidth();
    }

    public x(): Plots.AccessorScaleBinding<X, number>;
    public x(x: number | Accessor<number>): Bar<X, Y>;
    public x(x: X | Accessor<X>, xScale: Scale<X, number>): Bar<X, Y>;
    public x(x?: number | Accessor<number> | X | Accessor<X>, xScale?: Scale<X, number>): any {
      if (x == null) {
        return super.x();
      }

      if (xScale == null) {
        super.x(<number | Accessor<number>>x);
      } else {
        super.x(< X | Accessor<X>>x, xScale);
        xScale.onUpdate(this._updateBarPixelWidthCallback);
      }

      this._updateValueScale();
      return this;
    }

    public y(): Plots.AccessorScaleBinding<Y, number>;
    public y(y: number | Accessor<number>): Bar<X, Y>;
    public y(y: Y | Accessor<Y>, yScale: Scale<Y, number>): Bar<X, Y>;
    public y(y?: number | Accessor<number> | Y | Accessor<Y>, yScale?: Scale<Y, number>): any {
      if (y == null) {
        return super.y();
      }

      if (yScale == null) {
        super.y(<number | Accessor<number>>y);
      } else {
        super.y(<Y | Accessor<Y>>y, yScale);
        yScale.onUpdate(this._updateBarPixelWidthCallback);
      }

      this._updateValueScale();
      return this;
    }

    /**
     * Gets the orientation of the plot
     *
     * @return "vertical" | "horizontal"
     */
    public orientation() {
      return this._isVertical ? Bar.ORIENTATION_VERTICAL : Bar.ORIENTATION_HORIZONTAL;
    }

    public render() {
      super.render();
      this._updateBarPixelWidth();
      return this;
    }

    protected _createDrawer(dataset: Dataset) {
      return new Plottable.Drawers.Rectangle(dataset);
    }

    protected _setup() {
      super._setup();
      this._baseline = this._renderArea.append("line").classed("baseline", true);
    }

    /**
     * Gets the baseline value.
     * The baseline is the line that the bars are drawn from.
     *
     * @returns {X|Y}
     */
    public baselineValue(): X|Y;
    /**
     * Sets the baseline value.
     * The baseline is the line that the bars are drawn from.
     *
     * @param {X|Y} value
     * @returns {Bar} The calling Bar Plot.
     */
    public baselineValue(value: X|Y): Bar<X, Y>;
    public baselineValue(value?: X|Y): any {
      if (value == null) {
        if (this._baselineValue != null) {
          return this._baselineValue;
        }
        if (!this._projectorsReady()) {
          return 0;
        }
        let valueScale = this._isVertical ? this.y().scale : this.x().scale;
        if (!valueScale) {
          return 0;
        }

        if (valueScale instanceof Scales.Time) {
          return new Date(0);
        }

        return 0;
      }
      this._baselineValue = value;
      this._updateValueScale();
      this.render();
      return this;
    }

    public addDataset(dataset: Dataset) {
      super.addDataset(dataset);
      this._updateBarPixelWidth();
      return this;
    }

    protected _addDataset(dataset: Dataset) {
      dataset.onUpdate(this._updateBarPixelWidthCallback);
      super._addDataset(dataset);
      return this;
    }

    public removeDataset(dataset: Dataset) {
      dataset.offUpdate(this._updateBarPixelWidthCallback);
      super.removeDataset(dataset);
      this._updateBarPixelWidth();
      return this;
    }

    protected _removeDataset(dataset: Dataset) {
      dataset.offUpdate(this._updateBarPixelWidthCallback);
      super._removeDataset(dataset);
      return this;
    }

    public datasets(): Dataset[];
    public datasets(datasets: Dataset[]): Plot;
    public datasets(datasets?: Dataset[]): any {
      if (datasets == null) {
        return super.datasets();
      }

      super.datasets(datasets);
      this._updateBarPixelWidth();
      return this;
    }

    /**
     * Get whether bar labels are enabled.
     *
     * @returns {boolean} Whether bars should display labels or not.
     */
    public labelsEnabled(): boolean;
    /**
     * Sets whether labels are enabled.
     *
     * @param {boolean} labelsEnabled
     * @returns {Bar} The calling Bar Plot.
     */
    public labelsEnabled(enabled: boolean): Bar<X, Y>;
    public labelsEnabled(enabled?: boolean): any {
      if (enabled == null) {
        return this._labelsEnabled;
      } else {
        this._labelsEnabled = enabled;
        this.render();
        return this;
      }
    }

    /**
     * Gets the Formatter for the labels.
     */
    public labelFormatter(): Formatter;
    /**
     * Sets the Formatter for the labels.
     *
     * @param {Formatter} formatter
     * @returns {Bar} The calling Bar Plot.
     */
    public labelFormatter(formatter: Formatter): Bar<X, Y>;
    public labelFormatter(formatter?: Formatter): any {
      if (formatter == null) {
        return this._labelFormatter;
      } else {
        this._labelFormatter = formatter;
        this.render();
        return this;
      }
    }

    protected _createNodesForDataset(dataset: Dataset) {
      let drawer = super._createNodesForDataset(dataset);
      drawer.renderArea().classed(Bar._BAR_AREA_CLASS, true);
      let labelArea = this._renderArea.append("g").classed(Bar._LABEL_AREA_CLASS, true);
      let measurer = new SVGTypewriter.Measurers.CacheCharacterMeasurer(labelArea);
      let writer = new SVGTypewriter.Writers.Writer(measurer);
      this._labelConfig.set(dataset, { labelArea: labelArea, measurer: measurer, writer: writer });
      return drawer;
    }

    protected _removeDatasetNodes(dataset: Dataset) {
      super._removeDatasetNodes(dataset);
      let labelConfig = this._labelConfig.get(dataset);
      if (labelConfig != null) {
        labelConfig.labelArea.remove();
        this._labelConfig.delete(dataset);
      }
    }

    /**
     * Returns the PlotEntity nearest to the query point according to the following algorithm:
     *   - If the query point is inside a bar, returns the PlotEntity for that bar.
     *   - Otherwise, gets the nearest PlotEntity by the primary direction (X for vertical, Y for horizontal),
     *     breaking ties with the secondary direction.
     * Returns undefined if no PlotEntity can be found.
     *
     * @param {Point} queryPoint
     * @returns {PlotEntity} The nearest PlotEntity, or undefined if no PlotEntity can be found.
     */
    public entityNearest(queryPoint: Point): PlotEntity {
      let minPrimaryDist = Infinity;
      let minSecondaryDist = Infinity;

      let queryPtPrimary = this._isVertical ? queryPoint.x : queryPoint.y;
      let queryPtSecondary = this._isVertical ? queryPoint.y : queryPoint.x;

      // SVGRects are positioned with sub-pixel accuracy (the default unit
      // for the x, y, height & width attributes), but user selections (e.g. via
      // mouse events) usually have pixel accuracy. We add a tolerance of 0.5 pixels.
      let tolerance = 0.5;

      let closest: PlotEntity;
      this.entities().forEach((entity) => {
        if (!this._entityVisibleOnPlot(entity.position, entity.datum, entity.index, entity.dataset)) {
          return;
        }
        let primaryDist = 0;
        let secondaryDist = 0;
        let plotPt = entity.position;
        // if we're inside a bar, distance in both directions should stay 0
        let barBBox = Utils.DOM.elementBBox(entity.selection);
        if (!Utils.DOM.intersectsBBox(queryPoint.x, queryPoint.y, barBBox, tolerance)) {
          let plotPtPrimary = this._isVertical ? plotPt.x : plotPt.y;
          primaryDist = Math.abs(queryPtPrimary - plotPtPrimary);

          // compute this bar's min and max along the secondary axis
          let barMinSecondary: number;
          let barMaxSecondary: number;
          if(this._isVertical){
            barMinSecondary = barBBox.y - (entity.datum.y > this.baselineValue() ? 0 : barBBox.height);
            barMaxSecondary = barBBox.y + (entity.datum.y > this.baselineValue() ? barBBox.height : 0);
          }else {
            barMinSecondary = barBBox.x - (entity.datum.x < this.baselineValue() ? 0 : barBBox.width);
            barMaxSecondary = barBBox.x + (entity.datum.x < this.baselineValue() ? barBBox.width : 0);
          }

          if (queryPtSecondary >= barMinSecondary - tolerance && queryPtSecondary <= barMaxSecondary + tolerance) {
            // if we're within a bar's secondary axis span, it is closest in that direction
            secondaryDist = 0;
          } else {
            let plotPtSecondary = this._isVertical ? plotPt.y : plotPt.x;
            secondaryDist = Math.abs(queryPtSecondary - plotPtSecondary);
          }
        }
        // if we find a closer bar, record its distance and start new closest lists
        if (primaryDist < minPrimaryDist
            || primaryDist === minPrimaryDist && secondaryDist < minSecondaryDist) {
          closest = entity;
          minPrimaryDist = primaryDist;
          minSecondaryDist = secondaryDist;
        }
      });

      return closest;
    }

    /**
     * @deprecated As of release v1.1.0, replaced by _entityVisibleOnPlot()
     */
    protected _visibleOnPlot(datum: any, pixelPoint: Point, selection: d3.Selection<void>): boolean {
      Utils.Window.deprecated("Bar._visibleOnPlot()", "v1.1.0", "replaced by _entityVisibleOnPlot()");
      let xRange = { min: 0, max: this.width() };
      let yRange = { min: 0, max: this.height() };
      let barBBox = Utils.DOM.elementBBox(selection);

      return Plottable.Utils.DOM.intersectsBBox(xRange, yRange, barBBox);
    }

    protected _entityVisibleOnPlot(pixelPoint: Point, datum: any, index: number, dataset: Dataset) {
      let xRange = { min: 0, max: this.width() };
      let yRange = { min: 0, max: this.height() };

      let attrToProjector = this._generateAttrToProjector();

      let barBBox = {
        x: attrToProjector["x"](datum, index, dataset),
        y: attrToProjector["y"](datum, index, dataset),
        width: attrToProjector["width"](datum, index, dataset),
        height: attrToProjector["height"](datum, index, dataset)
      };

      return Plottable.Utils.DOM.intersectsBBox(xRange, yRange, barBBox);
    }

    /**
     * Gets the Entities at a particular Point.
     *
     * @param {Point} p
     * @returns {PlotEntity[]}
     */
    public entitiesAt(p: Point) {
      return this._entitiesIntersecting(p.x, p.y);
    }

    /**
     * Gets the Entities that intersect the Bounds.
     *
     * @param {Bounds} bounds
     * @returns {PlotEntity[]}
     */
    public entitiesIn(bounds: Bounds): PlotEntity[];
    /**
     * Gets the Entities that intersect the area defined by the ranges.
     *
     * @param {Range} xRange
     * @param {Range} yRange
     * @returns {PlotEntity[]}
     */
    public entitiesIn(xRange: Range, yRange: Range): PlotEntity[];
    public entitiesIn(xRangeOrBounds: Range | Bounds, yRange?: Range): PlotEntity[] {
      let dataXRange: Range;
      let dataYRange: Range;
      if (yRange == null) {
        let bounds = (<Bounds> xRangeOrBounds);
        dataXRange = { min: bounds.topLeft.x, max: bounds.bottomRight.x };
        dataYRange = { min: bounds.topLeft.y, max: bounds.bottomRight.y };
      } else {
        dataXRange = (<Range> xRangeOrBounds);
        dataYRange = yRange;
      }
      return this._entitiesIntersecting(dataXRange, dataYRange);
    }

    private _entitiesIntersecting(xValOrRange: number | Range, yValOrRange: number | Range): PlotEntity[] {
      let intersected: PlotEntity[] = [];
      this.entities().forEach((entity) => {
        if (Utils.DOM.intersectsBBox(xValOrRange, yValOrRange, Utils.DOM.elementBBox(entity.selection))) {
          intersected.push(entity);
        }
      });
      return intersected;
    }

    private _updateValueScale() {
      if (!this._projectorsReady()) {
        return;
      }
      let valueScale = this._isVertical ? this.y().scale : this.x().scale;
      if (valueScale instanceof QuantitativeScale) {
        let qscale = <QuantitativeScale<any>> valueScale;
        qscale.addPaddingExceptionsProvider(this._baselineValueProvider);
        qscale.addIncludedValuesProvider(this._baselineValueProvider);
      }
    }

    protected _additionalPaint(time: number) {
      let primaryScale: Scale<any, number> = this._isVertical ? this.y().scale : this.x().scale;
      let scaledBaseline = primaryScale.scale(this.baselineValue());

      let baselineAttr: any = {
        "x1": this._isVertical ? 0 : scaledBaseline,
        "y1": this._isVertical ? scaledBaseline : 0,
        "x2": this._isVertical ? this.width() : scaledBaseline,
        "y2": this._isVertical ? scaledBaseline : this.height()
      };

      this._getAnimator("baseline").animate(this._baseline, baselineAttr);

      this.datasets().forEach((dataset) => this._labelConfig.get(dataset).labelArea.selectAll("g").remove());
      if (this._labelsEnabled) {
        Utils.Window.setTimeout(() => this._drawLabels(), time);
      }
    }

    /**
     * Makes sure the extent takes into account the widths of the bars
     */
    protected _extentsForProperty(property: string) {
      let extents = super._extentsForProperty(property);

      let accScaleBinding: Plots.AccessorScaleBinding<any, any>;
      if (property === "x" && this._isVertical) {
        accScaleBinding = this.x();
      } else if (property === "y" && !this._isVertical) {
        accScaleBinding = this.y();
      } else {
        return extents;
      }

      if (!(accScaleBinding && accScaleBinding.scale && accScaleBinding.scale instanceof QuantitativeScale)) {
        return extents;
      }

      let scale = <QuantitativeScale<any>>accScaleBinding.scale;

      // To account for inverted domains
      extents = extents.map((extent) => d3.extent([
        scale.invert(scale.scale(extent[0]) - this._barPixelWidth / 2),
        scale.invert(scale.scale(extent[0]) + this._barPixelWidth / 2),
        scale.invert(scale.scale(extent[1]) - this._barPixelWidth / 2),
        scale.invert(scale.scale(extent[1]) + this._barPixelWidth / 2)
      ]));

      return extents;
    }

    private _drawLabels() {
      let dataToDraw = this._getDataToDraw();
      let labelsTooWide = false;
      this.datasets().forEach((dataset) => labelsTooWide = labelsTooWide || this._drawLabel(dataToDraw.get(dataset), dataset));
      if (this._hideBarsIfAnyAreTooWide && labelsTooWide) {
        this.datasets().forEach((dataset) => this._labelConfig.get(dataset).labelArea.selectAll("g").remove());
      }
    }

    private _drawLabel(data: any[], dataset: Dataset) {
      let attrToProjector = this._generateAttrToProjector();
      let labelConfig = this._labelConfig.get(dataset);
      let labelArea = labelConfig.labelArea;
      let measurer = labelConfig.measurer;
      let writer = labelConfig.writer;

      let drawLabel = (d: any, i: number) => {
        let valueAccessor = this._isVertical ? this.y().accessor : this.x().accessor;
        let value = valueAccessor(d, i, dataset);
        let valueScale: Scale<any, number> = this._isVertical ? this.y().scale : this.x().scale;
        let scaledValue = valueScale != null ? valueScale.scale(value) : value;
        let scaledBaseline = valueScale != null ? valueScale.scale(this.baselineValue()) : this.baselineValue();

        let barWidth = attrToProjector["width"](d, i, dataset);
        let barHeight = attrToProjector["height"](d, i, dataset);
        let text = this._labelFormatter(valueAccessor(d, i, dataset));
        let measurement = measurer.measure(text);

        let xAlignment = "center";
        let yAlignment = "center";
        let labelContainerOrigin = {
          x: attrToProjector["x"](d, i, dataset),
          y: attrToProjector["y"](d, i, dataset)
        };
        let containerWidth = barWidth;
        let containerHeight = barHeight;

        let labelOrigin = {
          x: labelContainerOrigin.x,
          y: labelContainerOrigin.y
        };

        let showLabelOnBar: boolean;

        if (this._isVertical) {
          labelOrigin.x += containerWidth / 2 - measurement.width / 2;

          let barY = attrToProjector["y"](d, i, dataset);
          let effectiveBarHeight = barHeight;
          if (barY + barHeight > this.height()) {
            effectiveBarHeight = this.height() - barY;
          } else if (barY < 0) {
            effectiveBarHeight = barY + barHeight;
          }
          let offset = Bar._LABEL_VERTICAL_PADDING;
          showLabelOnBar = measurement.height + 2 * offset <= effectiveBarHeight;

          if (showLabelOnBar) {
            if (scaledValue < scaledBaseline) {
              labelContainerOrigin.y += offset;
              yAlignment = "top";
              labelOrigin.y += offset;
            } else {
              labelContainerOrigin.y -= offset;
              yAlignment = "bottom";
              labelOrigin.y += containerHeight - offset - measurement.height;
            }
          } else { // show label off bar
            containerHeight = barHeight + offset + measurement.height;
            if (scaledValue <= scaledBaseline) {
              labelContainerOrigin.y -= offset + measurement.height;
              yAlignment = "top";
              labelOrigin.y -= offset + measurement.height;
            } else {
              yAlignment = "bottom";
              labelOrigin.y += barHeight + offset;
            }
          }
        } else { // horizontal
          labelOrigin.y += containerHeight / 2 - measurement.height / 2;

          let barX = attrToProjector["x"](d, i, dataset);
          let effectiveBarWidth = barWidth;
          if (barX + barWidth > this.width()) {
            effectiveBarWidth = this.width() - barX;
          } else if (barX < 0) {
            effectiveBarWidth = barX + barWidth;
          }
          let offset = Bar._LABEL_HORIZONTAL_PADDING;
          showLabelOnBar = measurement.width + 2 * offset <= effectiveBarWidth;

          if (showLabelOnBar) {
            if (scaledValue < scaledBaseline) {
              labelContainerOrigin.x += offset;
              xAlignment = "left";
              labelOrigin.x += offset;
            } else {
              labelContainerOrigin.x -= offset;
              xAlignment = "right";
              labelOrigin.x += containerWidth - offset - measurement.width;
            }
          } else { // show label off bar
            containerWidth = barWidth + offset + measurement.width;
            if (scaledValue < scaledBaseline) {
              labelContainerOrigin.x -= offset + measurement.width;
              xAlignment = "left";
              labelOrigin.x -= offset + measurement.width;
            } else {
              xAlignment = "right";
              labelOrigin.x += barWidth + offset;
            }
          }
        }

        let labelContainer = labelArea.append("g").attr("transform", `translate(${labelContainerOrigin.x}, ${labelContainerOrigin.y})`);

        if (showLabelOnBar) {
          labelContainer.classed("on-bar-label", true);
          let color = attrToProjector["fill"](d, i, dataset);
          let dark = Utils.Color.contrast("white", color) * 1.6 < Utils.Color.contrast("black", color);
          labelContainer.classed(dark ? "dark-label" : "light-label", true);
        } else {
          labelContainer.classed("off-bar-label", true);
        }

        let hideLabel = labelOrigin.x < 0 ||
          labelOrigin.y < 0 ||
          labelOrigin.x + measurement.width > this.width() ||
          labelOrigin.y + measurement.height > this.height();
        labelContainer.style("visibility", hideLabel ? "hidden" : "inherit");

        let writeOptions = {
          selection: labelContainer,
          xAlign: xAlignment,
          yAlign: yAlignment,
          textRotation: 0
        };
        writer.write(text, containerWidth, containerHeight, writeOptions);

        let tooWide = this._isVertical ? barWidth < measurement.width : barHeight < measurement.height;
        return tooWide;
      };

      let labelTooWide = data.map(drawLabel);
      return labelTooWide.some((d: boolean) => d);
    }

    protected _generateDrawSteps(): Drawers.DrawStep[] {
      let drawSteps: Drawers.DrawStep[] = [];
      if (this._animateOnNextRender()) {
        let resetAttrToProjector = this._generateAttrToProjector();
        let primaryScale: Scale<any, number> = this._isVertical ? this.y().scale : this.x().scale;
        let scaledBaseline = primaryScale.scale(this.baselineValue());
        let positionAttr = this._isVertical ? "y" : "x";
        let dimensionAttr = this._isVertical ? "height" : "width";
        resetAttrToProjector[positionAttr] = () => scaledBaseline;
        resetAttrToProjector[dimensionAttr] = () => 0;
        drawSteps.push({attrToProjector: resetAttrToProjector, animator: this._getAnimator(Plots.Animator.RESET)});
      }
      drawSteps.push({attrToProjector: this._generateAttrToProjector(), animator: this._getAnimator(Plots.Animator.MAIN)});
      return drawSteps;
    }

    protected _generateAttrToProjector() {
      // Primary scale/direction: the "length" of the bars
      // Secondary scale/direction: the "width" of the bars
      let attrToProjector = super._generateAttrToProjector();
      let primaryScale: Scale<any, number> = this._isVertical ? this.y().scale : this.x().scale;
      let primaryAttr = this._isVertical ? "y" : "x";
      let secondaryAttr = this._isVertical ? "x" : "y";
      let scaledBaseline = primaryScale.scale(this.baselineValue());

      let positionF = this._isVertical ? Plot._scaledAccessor(this.x()) : Plot._scaledAccessor(this.y());
      let widthF = attrToProjector["width"];
      let originalPositionFn = this._isVertical ? Plot._scaledAccessor(this.y()) : Plot._scaledAccessor(this.x());
      let heightF = (d: any, i: number, dataset: Dataset) => {
        return Math.abs(scaledBaseline - originalPositionFn(d, i, dataset));
      };

      attrToProjector["width"] = this._isVertical ? widthF : heightF;
      attrToProjector["height"] = this._isVertical ? heightF : widthF;

      attrToProjector[secondaryAttr] = (d: any, i: number, dataset: Dataset) =>
        positionF(d, i, dataset) - widthF(d, i, dataset) / 2;

      attrToProjector[primaryAttr] = (d: any, i: number, dataset: Dataset) => {
        let originalPos = originalPositionFn(d, i, dataset);
        // If it is past the baseline, it should start at the baselin then width/height
        // carries it over. If it's not past the baseline, leave it at original position and
        // then width/height carries it to baseline
        return (originalPos > scaledBaseline) ? scaledBaseline : originalPos;
      };

      return attrToProjector;
    }

    /**
     * Computes the barPixelWidth of all the bars in the plot.
     *
     * If the position scale of the plot is a CategoryScale and in bands mode, then the rangeBands function will be used.
     * If the position scale of the plot is a QuantitativeScale, then the bar width is equal to the smallest distance between
     * two adjacent data points, padded for visualisation.
     */
    protected _getBarPixelWidth(): number {
      if (!this._projectorsReady()) { return 0; }
      let barPixelWidth: number;
      let barScale: Scale<any, number> = this._isVertical ? this.x().scale : this.y().scale;
      if (barScale instanceof Plottable.Scales.Category) {
        barPixelWidth = (<Plottable.Scales.Category> barScale).rangeBand();
      } else {
        let barAccessor = this._isVertical ? this.x().accessor : this.y().accessor;

        let numberBarAccessorData = d3.set(Utils.Array.flatten(this.datasets().map((dataset) => {
          return dataset.data().map((d, i) => barAccessor(d, i, dataset))
                               .filter((d) => d != null)
                               .map((d) => d.valueOf());
        }))).values().map((value) => +value);

        numberBarAccessorData.sort((a, b) => a - b);

        let scaledData = numberBarAccessorData.map((datum) => barScale.scale(datum));
        let barAccessorDataPairs = d3.pairs(scaledData);
        let barWidthDimension = this._isVertical ? this.width() : this.height();

        barPixelWidth = Utils.Math.min(barAccessorDataPairs, (pair: any[], i: number) => {
          return Math.abs(pair[1] - pair[0]);
        }, barWidthDimension * Bar._SINGLE_BAR_DIMENSION_RATIO);

        barPixelWidth *= Bar._BAR_WIDTH_RATIO;
      }
      return barPixelWidth;
    }

    private _updateBarPixelWidth() {
      this._barPixelWidth = this._getBarPixelWidth();
    }

    public entities(datasets = this.datasets()): PlotEntity[] {
      if (!this._projectorsReady()) {
        return [];
      }
      let entities = super.entities(datasets);
      return entities;
    }

    protected _pixelPoint(datum: any, index: number, dataset: Dataset) {
      let attrToProjector = this._generateAttrToProjector();
      let rectX = attrToProjector["x"](datum, index, dataset);
      let rectY = attrToProjector["y"](datum, index, dataset);
      let rectWidth = attrToProjector["width"](datum, index, dataset);
      let rectHeight = attrToProjector["height"](datum, index, dataset);
      let x: number;
      let y: number;
      let originalPosition = (this._isVertical ? Plot._scaledAccessor(this.y()) : Plot._scaledAccessor(this.x()))(datum, index, dataset);
      let scaledBaseline = (<Scale<any, any>> (this._isVertical ? this.y().scale : this.x().scale)).scale(this.baselineValue());
      if(this._isVertical){
        x = rectX + rectWidth / 2;
        y = originalPosition <= scaledBaseline ? rectY : rectY + rectHeight;
      }else {
        x = originalPosition >= scaledBaseline ? rectX + rectWidth: rectX;
        y = rectY + rectHeight / 2;
      }
      return { x: x, y: y };
    }

    protected _uninstallScaleForKey(scale: Scale<any, number>, key: string) {
      scale.offUpdate(this._updateBarPixelWidthCallback);
      super._uninstallScaleForKey(scale, key);
    }

    protected _getDataToDraw() {
      let dataToDraw = new Utils.Map<Dataset, any[]>();
      let attrToProjector = this._generateAttrToProjector();
      this.datasets().forEach((dataset: Dataset) => {
        let data = dataset.data().filter((d, i) => Utils.Math.isValidNumber(attrToProjector["x"](d, i, dataset)) &&
                                                   Utils.Math.isValidNumber(attrToProjector["y"](d, i, dataset)) &&
                                                   Utils.Math.isValidNumber(attrToProjector["width"](d, i, dataset)) &&
                                                   Utils.Math.isValidNumber(attrToProjector["height"](d, i, dataset)));
        dataToDraw.set(dataset, data);
      });
      return dataToDraw;
    }
  }
}
}
