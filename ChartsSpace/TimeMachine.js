/*

Markets are a function of time. When watching them, end users must be positioned at one particular point in time. The system currently allows users
to position themselves at any time they like.

In the future, it will be usefull to explore markets and compare them at different times simultaneously. Anticipating that future this module exists.
All the charts that depand on a datetime are children of this object Time Machine. In the future we will allow users to have more than one Time Machine,
each one with it own charts, and each one positioned at an especific point in titme.

*/

function newTimeMachine () {
  const MODULE_NAME = 'Time Machine'
  const logger = newWebDebugLog()
  logger.fileName = MODULE_NAME

  let thisObject = {
    container: undefined,
    timeScale: undefined,
    rateScale: undefined,
    charts: [],
    physics: physics,
    drawBackground: drawBackground,
    draw: draw,
    getContainer: getContainer,     // returns the inner most container that holds the point received by parameter.
    initialize: initialize,
    finalize: finalize
  }

  thisObject.container = newContainer()
  thisObject.container.initialize(MODULE_NAME)
  thisObject.container.isDraggeable = false
  thisObject.container.detectMouseOver = true

  thisObject.container.frame.width = TIME_MACHINE_WIDTH
  thisObject.container.frame.height = TIME_MACHINE_HEIGHT

  thisObject.container.frame.position.x = browserCanvas.width / 2 - TIME_MACHINE_WIDTH / 2
  thisObject.container.frame.position.y = browserCanvas.height / 2 - TIME_MACHINE_HEIGHT / 2

  let controlPanelHandle             // We need this to destroy the Panel when this object is itself destroyed or no longer needs it...
                                   // ... also to request a reference to the object for the cases we need it.
  const SEPARATION_BETWEEN_TIMELINE_CHARTS = 1.5

  let timeLineCoordinateSystem = newTimeLineCoordinateSystem()

  let mouse = {
    position: {
      x: 0,
      y: 0
    }
  }

  return thisObject

  function finalize () {
    for (let i = 0; i < thisObject.charts.length; i++) {
      let chart = thisObject.charts[i]
      chart.finalize()
    }

    thisObject.container.finalize()
    thisObject.container = undefined

    thisObject.timeScale.finalize()
    thisObject.timeScale = undefined
    thisObject.rateScale.finalize()
    thisObject.rateScale = undefined
  }

  function initialize (callBackFunction) {
     /* Each Time Machine has a Control Panel. */

    let panelOwner = 'Global'
    controlPanelHandle = canvas.panelsSpace.createNewPanel('Time Control Panel', undefined, panelOwner)
    let controlPanel = canvas.panelsSpace.getPanel(controlPanelHandle, panelOwner)

    recalculateScale()

    thisObject.container.eventHandler.listenToEvent('Dimmensions Changed', function (event) {
      recalculateScale()
      moveToUserPosition(thisObject.container, timeLineCoordinateSystem, false, false, event.mousePosition)
    })

     /* First, we initialize the market that we are going to show first on screen. Later all the other markets will be initialized on the background. */

    let position = 0 // This defines the position of each chart respect to each other.

    let timelineChart = newTimelineChart()

    timelineChart.container.connectToParent(thisObject.container, true, true, false, true, true, true)
    timelineChart.container.frame.height = thisObject.container.frame.height

    timelineChart.container.frame.position.x = thisObject.container.frame.width / 2 - timelineChart.container.frame.width / 2
    timelineChart.container.frame.position.y = timelineChart.container.frame.height * SEPARATION_BETWEEN_TIMELINE_CHARTS * position

    position++

    timelineChart.initialize(DEFAULT_EXCHANGE, DEFAULT_MARKET, timeLineCoordinateSystem, onDefaultInitialized)

    function onDefaultInitialized (err) {
      if (err.result !== GLOBAL.DEFAULT_OK_RESPONSE.result) {
        callBackFunction(err)
        return
      }

      thisObject.charts.push(timelineChart)

      controlPanel.container.eventHandler.listenToEvent('Datetime Changed', timelineChart.setDatetime, undefined)
      timelineChart.container.eventHandler.listenToEvent('Datetime Changed', controlPanel.setDatetime)

     /* Each Time Machine has a Time Scale and a Right Scale. */

      thisObject.timeScale = newTimeScale()

      thisObject.timeScale.container.eventHandler.listenToEvent('Lenght Percentage Changed', function (event) {
        thisObject.container.frame.width = TIME_MACHINE_WIDTH * event.lenghtPercentage / 100
        thisObject.container.eventHandler.raiseEvent('Dimmensions Changed', event)
      })

      thisObject.timeScale.initialize()

      thisObject.rateScale = newRateScale()

      thisObject.rateScale.container.eventHandler.listenToEvent('Height Percentage Changed', function (event) {
        thisObject.container.frame.height = TIME_MACHINE_HEIGHT * event.heightPercentage / 100
        thisObject.container.eventHandler.raiseEvent('Dimmensions Changed', event)
      })

      thisObject.rateScale.initialize(timeLineCoordinateSystem)

      thisObject.container.eventHandler.listenToEvent('onMouseOver', onMouseOver)

      initializeTheRest()
    }

    function onMouseOver (event) {
      thisObject.timeScale.visible = true
      thisObject.rateScale.visible = true

      mouse.position.x = event.x
      mouse.position.y = event.y

      thisObject.rateScale.setMousePosition(event)
    }

    function initializeTheRest () {
      let leftToInitialize = SUPPORTED_EXCHANGES.length * SUPPORTED_MARKETS.length - 1 // The default exchange and market was already initialized.
      let alreadyInitialized = 0

      if (alreadyInitialized === leftToInitialize) {
        callBackFunction(GLOBAL.DEFAULT_OK_RESPONSE)
        return
      }

      for (let i = 0; i < SUPPORTED_EXCHANGES.length; i++) {
        for (let j = 0; j < SUPPORTED_MARKETS.length; j++) {
          let exchange = SUPPORTED_EXCHANGES[i]
          let market = SUPPORTED_MARKETS[j]

          if (
           exchange === DEFAULT_EXCHANGE &&
           market.assetA === DEFAULT_MARKET.assetA &&
           market.assetB === DEFAULT_MARKET.assetB
         ) { continue }

          initializeTimelineChart(exchange, market)
        }
      }

      function initializeTimelineChart (exchange, market) {
        let timelineChart = newTimelineChart()

        timelineChart.container.connectToParent(thisObject.container, true, true, false, true, true, true)

        timelineChart.container.frame.height = thisObject.container.frame.height

        timelineChart.container.frame.position.x = thisObject.container.frame.width / 2 - timelineChart.container.frame.width / 2
        timelineChart.container.frame.position.y = timelineChart.container.frame.height * SEPARATION_BETWEEN_TIMELINE_CHARTS * position

        position++

        timelineChart.initialize(exchange, market, timeLineCoordinateSystem, finalSteps)

        function finalSteps () {
          thisObject.charts.push(timelineChart)

          controlPanel.container.eventHandler.listenToEvent('Datetime Changed', timelineChart.setDatetime, undefined)
          timelineChart.container.eventHandler.listenToEvent('Datetime Changed', controlPanel.setDatetime)

          alreadyInitialized++

          if (alreadyInitialized === leftToInitialize) {
            callBackFunction(GLOBAL.DEFAULT_OK_RESPONSE)
          }
        }
      }
    }
  }

  function getContainer (point, purpose) {
    let container

    if (thisObject.timeScale !== undefined) {
      container = thisObject.timeScale.getContainer(point)
      if (container !== undefined) {
        if (container.isForThisPurpose(purpose)) {
          return container
        }
      }
    }

    if (thisObject.rateScale !== undefined) {
      container = thisObject.rateScale.getContainer(point)
      if (container !== undefined) {
        if (container.isForThisPurpose(purpose)) {
          return container
        }
      }
    }

    for (let i = 0; i < this.charts.length; i++) {
      container = this.charts[i].getContainer(point)
      if (container !== undefined) {
        if (container.isForThisPurpose(purpose)) {
          if (thisObject.container.frame.isThisPointHere(point) === true) {
            return container
          }
        }
      }
    }

    if (thisObject.container.frame.isThisPointHere(point) === true) {
      return thisObject.container
    } else {
      if (purpose === GET_CONTAINER_PURPOSE.MOUSE_OVER) {
        thisObject.container.eventHandler.raiseEvent('onMouseNotOver')
        thisObject.timeScale.visible = false
        thisObject.rateScale.visible = false
      }
      return
    }
  }

  function physics () {
    thisObjectPhysics()
    childrenPhysics()
  }

  function thisObjectPhysics () {
    /* Mouse Position Date Calculation */

    let datePoint = {
      x: mouse.position.x,
      y: 0
    }

    let mouseDate = getDateFromPoint(datePoint, thisObject.container, timeLineCoordinateSystem)

    thisObject.timeScale.date = new Date(mouseDate)

    /* Screen Corner Date Calculation */

    let point = {
      x: 0,
      y: 0
    }

    let cornerDate = getDateFromPoint(point, thisObject.container, timeLineCoordinateSystem)
    cornerDate = new Date(cornerDate)
    window.localStorage.setItem('Date @ Screen Corner', cornerDate.toUTCString())
  }

  function childrenPhysics () {
    thisObject.timeScale.physics()
    thisObject.rateScale.physics()
    for (let i = 0; i < thisObject.charts.length; i++) {
      let chart = thisObject.charts[i]
      chart.physics()
    }

/* timeScale Positioning */

    thisObject.timeScale.container.frame.position.x = mouse.position.x - thisObject.timeScale.container.frame.width / 2

    let point = {
      x: 0,
      y: thisObject.container.frame.height / 10
    }

    point = transformThisPoint(point, thisObject.container.frame.container)
    point = viewPort.fitIntoVisibleArea(point)

    thisObject.timeScale.container.frame.position.y = point.y + 6
  }

  function drawBackground () {
    thisBackground()

    if (thisObject.container.frame.isInViewPort()) {
      for (let i = 0; i < this.charts.length; i++) {
        let chart = this.charts[i]
        chart.drawBackground()
      }
    }
  }

  function draw () {
    if (thisObject.container.frame.isInViewPort()) {
      for (let i = 0; i < this.charts.length; i++) {
        let chart = this.charts[i]
        chart.draw()
      }

      if (thisObject.timeScale !== undefined) { thisObject.timeScale.draw() }
      // if (thisObject.rateScale !== undefined) { thisObject.rateScale.draw() }

     // thisObject.container.frame.draw(false, true, false)
    }
  }

  function thisBackground () {
    let params = {
      cornerRadius: 15,
      lineWidth: 5,
      opacity: 1,
      container: thisObject.container,
      borderColor: UI_COLOR.RUSTED_RED,
      backgroundColor: UI_COLOR.WHITE,
      fitFunction: thisObject.fitFunction,
      coordinateSystem: timeLineCoordinateSystem
    }

    roundedCornersBackground(params)
  }

  function recalculateScale () {
    let minValue = {
      x: MIN_PLOTABLE_DATE.valueOf(),
      y: 0
    }

    let maxValue = {
      x: MAX_PLOTABLE_DATE.valueOf(),
      y: nextPorwerOf10(USDT_BTC_HTH) / 4
    }

    timeLineCoordinateSystem.initialize(
          minValue,
          maxValue,
          thisObject.container.frame.width,
          thisObject.container.frame.height
      )
  }
}

