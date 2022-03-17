var the_canvas = null;
var bingRoad = new ol.layer.Tile({
  visible: true,
  preload: Infinity,
  name: 'Bing Road',
  source: new ol.source.BingMaps({
    key: 'OR4jawvlzJkSpZV1JKxh~B_CAibllXzRX1f69gB-vsQ~AmzjZ1xIDQF-XPoVbJfgITtHRNUuZP0wZc3aX9tbMC6UWpM3VgxCcOg0IBbKz_X-',
    imagerySet: 'AerialWithLabelsOnDemand',
    crossOrigin: 'Anonymous'
  }),
});
var dragAndDropInteraction = new ol.interaction.DragAndDrop({
  formatConstructors: [ol.format.GPX, ol.format.GeoJSON, ol.format.IGC, ol.format.TopoJSON],
});
var raster = null;
var geoTIFFDEM = new ol.layer.Image({
  name: 'GeoTIFF DEM',
  title: 'GeoTIFF DEM',
  visible: true,
  displayInLayerSwitcher: true
});
var geoTIFFRGB = new ol.layer.Image({
  name: 'GeoTIFF RGB',
  title: "GeoTIFF RGB",
  visible: true,
  displayInLayerSwitcher: true
});
var map = new ol.Map({
  interactions: ol.interaction.defaults().extend([dragAndDropInteraction]),
  // controls: ol.control.defaults().extend([scaleControl(), new ol.control.FullScreen()]),
  layers: [
    bingRoad,
    geoTIFFDEM,
    geoTIFFRGB
  ],
  target: 'map',
  view: new ol.View({
    center: [0, 0],
    zoom: 2
  }),
});

function setRasterSource() {
  const imgSource = new ol.source.ImageStatic({
    url: the_canvas.toDataURL("image/png"),
    imageExtent: box,
    projection: 'EPSG:4326' //to enable on-the-fly raster reprojection
  });
  geoTIFFDEM.setSource(imgSource);
}

function updateTextInput(val, id) {
  $("#" + id).text(val);
  var min = $("#ex1_min").val();
  var max = $("#ex1_max").val();
  var domain = [min, max];
  plot.setDomain([min, max]);
  plot.render();
  setRasterSource();
}

function getMax(arr) {
  let len = arr.length;
  let max = -Infinity;

  while (len--) {
    max = arr[len] > max ? arr[len] : max;
  }
  return max;
}

function getMin(arr) {
  let len = arr.length;
  let min = +Infinity;

  while (len--) {
    min = arr[len] < min ? arr[len] : min;
  }
  return min;
}
async function displayRaster(data) {
  $(".rastersSettings").hide();
  const tiff = await GeoTIFF.fromArrayBuffer(data);
  const img = await tiff.getImage();
  const width = img.getWidth();
  const height = img.getHeight();
  const subfileNumber = await tiff.getImageCount();

  const readImageData = async (image, options = {}) => {
    rasters = await image.readRasters(options);
    const {
      width,
      height
    } = rasters;
    band = image.getSamplesPerPixel();
    const arr = []; //custom array for canvas
    for (let i = 0; i < rasters[0].length; i++) { //loop through first band
      if (band > 1) { // for multiple bands
        if (rasters[0][i] == 0 && rasters[1][i] == 0 && rasters[2][i] == 0) {
          // hide pixels having value 0 for all 3 bands i-e: black pixels
          arr[i * 4] = rasters[0][i]; //r
          arr[i * 4 + 1] = rasters[1][i]; //g
          arr[i * 4 + 2] = rasters[2][i]; //b
          arr[i * 4 + 3] = 0; //a
        } else {
          arr[i * 4] = rasters[0][i];
          arr[i * 4 + 1] = rasters[1][i];
          arr[i * 4 + 2] = rasters[2][i];
          arr[i * 4 + 3] = 255;
        }
      } else {
        arr[i * 4] = rasters[0][i];
        arr[i * 4 + 1] = rasters[0][i];
        arr[i * 4 + 2] = rasters[0][i];
        arr[i * 4 + 3] = 255;
      }
    }
    const data = new Uint8ClampedArray(arr);
    return new ImageData(data, width, height);
  }

  const showImage = async (subfileIndex) => {
    image = await tiff.getImage(subfileIndex);
    const maxSize = 1024;
    let startX = parseInt((image.getWidth() - width) / 2);
    if (startX < 0) startX = 0;
    let endX = parseInt((image.getWidth() + width) / 2);
    if (endX > image.getWidth())
      endX = image.getWidth();

    let startY = parseInt((image.getHeight() - height) / 2);
    if (startY < 0) startY = 0;
    let endY = parseInt((image.getHeight() + height) / 2);
    if (endY > image.getHeight()) {
      endY = image.getHeight();
    }
    const data = await readImageData(image, {
      window: [startX, startY, endX, endY]
    });

    if (band > 1) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const extent = image.getBoundingBox();
      canvas.width = width;
      canvas.height = height;
      ctx.putImageData(data, 0, 0);
      var sourceRGB = new ol.source.ImageStatic({
        url: canvas.toDataURL(),
        projection: 'EPSG:4326',
        imageExtent: extent
      });
      geoTIFFRGB.setSource(sourceRGB);
      zoomToExtent(ol.proj.transformExtent(extent, 'EPSG:4326', 'EPSG:3857'));
    } else {
      const rawBox = image.getBoundingBox();
      box = [rawBox[0], rawBox[1] - (rawBox[3] - rawBox[1]), rawBox[2], rawBox[1]];
      // const bands = image.readRasters();
      const minValue = getMin(rasters[0]);
      const maxValue = getMax(rasters[0]);
      var colorScale = 'earth';
      var domainVar = [minValue, maxValue];
      $("#ex1_min").attr("min", minValue);
      $("#ex1_min").attr("max", maxValue);
      $("#ex1_min_label").text(minValue);
      $("#ex1_max").attr("min", minValue);
      $("#ex1_max").attr("max", maxValue);
      $("#ex1_max_label").text(maxValue);
      the_canvas = document.createElement('canvas');
      plot = new plotty.plot({
        canvas: the_canvas,
        data: rasters[0],
        width: image.getWidth(),
        height: image.getHeight(),
        domain: domainVar,
        colorScale: colorScale,
        clampLow: true,
        clampHigh: true,
        noDataValue: 0
      });
      plot.render();
      const imgSource = new ol.source.ImageStatic({
        url: the_canvas.toDataURL("image/png"),
        imageExtent: box,
        projection: 'EPSG:4326' //to enable on-the-fly raster reprojection
      })
      zoomToExtent(ol.proj.transformExtent(imgSource.getImageExtent(), 'EPSG:4326', 'EPSG:3857'));
      geoTIFFDEM.setSource(imgSource);
      $(".rastersSettings").show();
    }
  }
  for (let i = 0; i < subfileNumber; i++) {
    await showImage(i)
  }
}

map.getViewport().addEventListener('drop', function(event) {
  var name = event.dataTransfer.files[0].name;
  if (name.indexOf("tif") !== -1) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    files[0].arrayBuffer().then(displayRaster);

  }
});

function zoomToExtent(extent) {
  map.getView().fit(extent, {
    duration: 1000,
    padding: [50, 50, 50, 50]
  });
}
