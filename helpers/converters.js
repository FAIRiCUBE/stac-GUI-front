import reprojectBoundingBox from "reproject-bbox";
import { parse } from "iso8601-duration";

const stacToForm = (stac) => {
  let formProduct = {
    state: "created",
    providers: [],
    assets: [],
    thumbnails: [],
    general: {},
    horizontal_axis: {
      bbox: [null, null],
    },
    vertical_axis: {
      bbox: [null, null],
    },
    time_axis: {
      regular: true,
    },
    other_dims: [],
    bands: [],
    reprojection_axis: {},
    legal: {},
    use_case_S4E: [],
    use_case_WER: [],
    use_case_NHM: [],
    use_case_NILU: [],
    platform: [],
  };
  Object.keys(stac.assets).forEach((asset) => {
    let pushedAsset = {
      name: asset,
      href: stac.assets[asset].href,
    };
    if (stac.assets[asset].roles.includes("data")) {
      formProduct.assets.push(pushedAsset);
    } else if (stac.assets[asset].roles.includes("thumbnail"))
      formProduct.thumbnails.push(pushedAsset);
  });
  stac.properties.providers.map((provider) => {
    let providerObject = {
      organization_name: provider.name,
      organization: provider.organization,
      comments: provider.description,
      doc_link: provider.url,
      organization_email: provider.email,
      ORCID_ID: provider.orcid_id,
      project_purpose: provider.project_purpose,
    };
    formProduct.providers.push(providerObject);
  });
  formProduct.identifier = stac.id;
  formProduct.title = stac.properties.title;
  formProduct.datasource_type = stac.properties.datasource_type;
  formProduct.description = stac.properties.description;
  formProduct.legal.keywords = stac.properties.keywords;
  formProduct.general.area_cover = stac.properties.area_cover;
  const cube = stac.properties["cube:dimensions"];
  const h_axis = cube.x || null;
  const v_axis = cube.y || null;
  formProduct.horizontal_axis.bbox = h_axis.extent || h_axis.values;
  formProduct.horizontal_axis.horizontal_crs = h_axis.reference_system;
  formProduct.horizontal_axis.unit_of_measure = h_axis.unit_of_measure;
  formProduct.horizontal_axis.interpolation = h_axis.interpolation;
  formProduct.horizontal_axis.resolution = h_axis.step;
  formProduct.horizontal_axis.regular = h_axis.values === undefined;

  formProduct.vertical_axis.bbox = v_axis.extent || v_axis.values;
  formProduct.vertical_axis.vertical_crs = v_axis.reference_system;
  formProduct.vertical_axis.unit_of_measure = v_axis.unit_of_measure;
  formProduct.vertical_axis.interpolation = v_axis.interpolation;
  formProduct.vertical_axis.resolution = v_axis.step;
  formProduct.vertical_axis.regular = v_axis.values === undefined;

  Object.keys(cube)
    .filter((dim) => !["spatial", "temporal"].includes(cube[dim].type))
    .map((dim) => {
      formProduct.other_dims.push({
        name: dim,
        bbox: Array.isArray(cube[dim].extent) ? cube[dim].extent : [],
        values: cube[dim].values,
        reference_system: cube[dim].reference_system,
        unit_of_measure: cube[dim].unit_of_measure,
        interpolation: cube[dim].interpolation,
        resolution: cube[dim].step,
        regular: cube[dim].values === undefined,
      });
    });

  let timeDim = cube.time || cube.t;
  let range = timeDim.extent ? timeDim.extent : timeDim.values;
  range = range.map((time) =>
    ![undefined, null].includes(time) && typeof time === "string"
      ? time.replace("Z", "")
      : time
  );
  timeDim.extent
    ? (formProduct.time_axis.bbox = range)
    : (formProduct.time_axis.values = range);
  if (timeDim.step !== undefined) formProduct.time_axis.step = {};
  if (typeof timeDim.step === "string") {
    let parsedStep = parse(timeDim.step);
    formProduct.time_axis.step.Y = parsedStep.years;
    formProduct.time_axis.step.M = parsedStep.months;
    formProduct.time_axis.step.D = parsedStep.days;
    formProduct.time_axis.step.H = parsedStep.hours;
    formProduct.time_axis.step.Ms = parsedStep.minutes;
    formProduct.time_axis.step.S = parsedStep.seconds;
  }

  const bands = stac.properties["raster:bands"];
  if (bands !== undefined && Array.isArray(bands))
    bands.map((band) => {
      formProduct.bands.push({
        band_name: band.name,
        unit: band.unit,
        data_type: band.data_type,
        nodata: band.nodata,
        definition: band.definition,
        description: band.description,
        category_list: band.category_list,
        comment: band.comment,
      });
    });

  formProduct.reprojection_axis.re_projection_crs =
    stac.properties.re_projection_crs;
  formProduct.reprojection_axis.unit_of_measure =
    stac.properties.unit_of_measure;
  formProduct.reprojection_axis.resolution = stac.properties.resolution;

  formProduct.legal.license = stac.properties.license;
  formProduct.legal.personalData = stac.properties.personalData;
  formProduct.legal.Provenance_name = stac.properties.Provenance_name;
  formProduct.legal.datetime = stac.properties.datetime
    ? stac.properties.datetime.replace("Z", "")
    : null;

  formProduct.use_case_S4E = stac.properties.use_case_S4E;
  formProduct.use_case_WER = stac.properties.use_case_WER;
  formProduct.use_case_NHM = stac.properties.use_case_NHM;
  formProduct.use_case_NILU = stac.properties.use_case_NILU;

  formProduct.platform = stac.properties.platform || ["other"];
  formProduct.state = "edited";
  return formProduct;
};

const formToStac = (formProduct) => {
  let stac = {
    type: "Feature",
    stac_version: "2.2.0",
    id: "",
    properties: {
      license: "",
      Description: "",
      providers: [],
      dataSource: "",
      "cube:dimensions": {
        x: {
          axis: "x",
          extent: [],
          reference_system: "4326",
          type: "spatial",
        },
        y: {
          axis: "y",
          extent: [],
          reference_system: "4326",
          type: "spatial",
        },
        time: {
          extent: [],
          type: "temporal",
        },
      },
      datetime: "2000-01-01T00:00:00Z",
      "raster:bands": [],
    },

    geometry: {
      type: "Polygon",
      coordinates: [],
    },
    links: [
      {
        rel: "root",
        href: "../catalog.json",
        type: "application/json",
        title: "data-access catalog",
      },
      {
        rel: "parent",
        href: "../catalog.json",
        type: "application/json",
        title: "data-access catalog",
      },
    ],
    assets: {},
    bbox: [],
    stac_extensions: [
      "https://stac-extensions.github.io/raster/v1.1.0/schema.json",
      "https://stac-extensions.github.io/datacube/v2.0.0/schema.json",
    ],
  };

  formProduct.providers.map((provider) => {
    let providerObject = {
      name: provider.organization_name,
      organization: provider.organization,
      description: provider.comments,
      url: provider.doc_link,
      email: provider.organization_email,
      orcid_id: provider.ORCID_ID,
      project_purpose: provider.project_purpose,
    };
    stac.properties.providers.push(providerObject);
  });
  // TODO asset name must be unique since it is going to be an object key
  if (Array.isArray(formProduct.assets))
    formProduct.assets.map((asset) => {
      stac.assets[asset.name] = {
        href: asset.href,
        roles: ["data"],
      };
    });
  if (Array.isArray(formProduct.thumbnails))
    formProduct.thumbnails.map((thumbnail) => {
      stac.assets[thumbnail.name] = {
        href: thumbnail.href,
        roles: ["thumbnail"],
      };
    });
  stac.id = formProduct.identifier;
  stac.properties.title = formProduct.title;
  stac.properties.datasource_type = formProduct.datasource_type;
  stac.properties.description = formProduct.description;
  stac.properties.keywords = formProduct.legal.keywords;
  stac.properties.area_cover = formProduct.general.area_cover;
  const cube = stac.properties["cube:dimensions"];
  const h_axis = cube.x || null;
  const v_axis = cube.y || null;

  formProduct.horizontal_axis.regular
    ? (h_axis.extent = formProduct.horizontal_axis.bbox)
    : (h_axis.values = formProduct.horizontal_axis.bbox);

  h_axis.reference_system = formProduct.horizontal_axis.horizontal_crs;
  h_axis.unit_of_measure = formProduct.horizontal_axis.unit_of_measure;
  h_axis.interpolation = formProduct.horizontal_axis.interpolation;
  h_axis.step = formProduct.horizontal_axis.resolution;

  formProduct.vertical_axis.regular
    ? (v_axis.extent = formProduct.vertical_axis.bbox)
    : (v_axis.values = formProduct.vertical_axis.bbox);

  v_axis.reference_system = formProduct.vertical_axis.vertical_crs;
  v_axis.unit_of_measure = formProduct.vertical_axis.unit_of_measure;
  v_axis.interpolation = formProduct.vertical_axis.interpolation;
  v_axis.step = formProduct.vertical_axis.resolution;

  formProduct.other_dims.map((dim) => {
    cube[dim.name] = {
      name: dim.name,
      extent: dim.bbox || [],
      values: dim.values,
      reference_system: dim.reference_system,
      unit_of_measure: dim.unit_of_measure,
      interpolation: dim.interpolation,
      step: dim.resolution,
    };
  });

  // TODO get bbox if spatial axes are in values only
  let edges = [
    formProduct.horizontal_axis.bbox[0],
    formProduct.vertical_axis.bbox[0],
    formProduct.horizontal_axis.bbox[1],
    formProduct.vertical_axis.bbox[1],
  ];
  formProduct.horizontal_axis.horizontal_crs ===
    formProduct.vertical_axis.vertical_crs &&
  formProduct.horizontal_axis.horizontal_crs !== 4326
    ? (stac.bbox = reprojectBoundingBox({
        bbox: edges,
        from: Number(formProduct.horizontal_axis.horizontal_crs),
        to: 4326,
      }))
    : (stac.bbox = edges);
  stac.geometry.coordinates = [
    [stac.bbox[0], stac.bbox[1]],
    [stac.bbox[0], stac.bbox[3]],
    [stac.bbox[2], stac.bbox[3]],
    [stac.bbox[2], stac.bbox[1]],
  ];

  let range =
    formProduct.time_axis.bbox !== undefined &&
    Array.isArray(formProduct.time_axis.bbox)
      ? formProduct.time_axis.bbox
      : formProduct.time_axis.values;

  range = range.map((time) =>
    ![undefined, null].includes(time) && typeof time === "string"
      ? (time = `${time}Z`)
      : time
  );

  let dates = "P";
  let hasDates = false;
  let times = "T";
  let hasTimes = false;
  Object.keys(formProduct.time_axis.step).map((unit) => {
    let ts = formProduct.time_axis.step;
    if (ts[unit] !== undefined)
      if (["Y", "M", "D"].includes(unit)) {
        hasDates = true;
        dates = dates.concat("", `${ts[unit]}${unit}`);
      } else {
        hasTimes = true;
        times = times.concat("", `${ts[unit]}${unit}`);
      }
  });

  formProduct.time_axis.bbox !== undefined &&
  Array.isArray(formProduct.time_axis.bbox)
    ? (cube.time.extent = range)
    : (cube.time.values = range);
  dates = hasDates ? dates : "";
  times = hasTimes ? times.replace("Ms", "M") : "";

  cube.time.step = `${dates}${times}`;
  const bands = formProduct.bands;
  if (bands !== undefined && Array.isArray(bands))
    bands.map((band) => {
      stac.properties["raster:bands"].push({
        name: band.band_name,
        unit: band.unit,
        data_type: band.data_type,
        nodata: band.nodata,
        definition: band.definition,
        description: band.description,
        category_list: band.category_list,
        comment: band.comment,
      });
    });

  stac.properties.re_projection_crs =
    formProduct.reprojection_axis.re_projection_crs;
  stac.properties.unit_of_measure =
    formProduct.reprojection_axis.unit_of_measure;
  stac.properties.resolution = formProduct.reprojection_axis.resolution;

  stac.properties.license = formProduct.legal.license;
  stac.properties.personalData = formProduct.legal.personalData;
  stac.properties.Provenance_name = formProduct.legal.Provenance_name;
  stac.properties.datetime = `${formProduct.legal.datetime}Z`;

  stac.properties.use_case_S4E = formProduct.use_case_S4E;
  stac.properties.use_case_WER = formProduct.use_case_WER;
  stac.properties.use_case_NHM = formProduct.use_case_NHM;
  stac.properties.use_case_NILU = formProduct.use_case_NILU;

  stac.properties.platform = formProduct.platform;
  const itemState = "edited";
  return {
    stac: stac,
    state: itemState,
  };
};

export { formToStac, stacToForm };
