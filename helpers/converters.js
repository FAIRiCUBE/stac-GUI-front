import reprojectBoundingBox from "reproject-bbox";
import languages from "./languages.json";
import { parse } from "iso8601-duration";

const stacToForm = (stac) => {
  let formProduct = {
    state: "created",
    providers: [],
    third: {
      threeD: true,
    },
    assets: [],
    thumbnails: [],
    apis: [],
    general: {},
    horizontal_axis: {
      bbox: { x: [null, null], y: [null, null] },
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

  stac.links
    .filter((link) => link.rel == "example")
    .map((link) => {
      let pushedProcess = {
        title: link.title,
        href: link.href,
        description: link.description,
        language: link["example:language"],
        script: !link["example:container"],
      };
      formProduct.apis.push(pushedProcess);
    });

  stac.properties.providers.map((provider) => {
    let providerObject = {
      organization_name: provider.organization_name,
      organization: provider.organization,
      comments: provider.comments,
      doc_link: provider.doc_link,
      roles: provider.roles,
      organization_email: provider.organization_email,
      ORCID_ID: provider.ORCID_ID,
      project_purpose: provider.project_purpose,
    };
    formProduct.providers.push(providerObject);
  });
  formProduct.identifier = stac.id;
  formProduct.title = stac.properties.title;
  formProduct.datasource_type = stac.properties.datasource_type;
  formProduct.dataSource = stac.properties.dataSource;
  formProduct.description = stac.properties.description;
  formProduct.keywords = stac.properties.keywords;
  formProduct.documentation = stac.properties.documentation;
  formProduct.general.area_cover = stac.properties.area_cover;
  formProduct.general.crs = stac.properties.crs;
  const cube = stac.properties["cube:dimensions"];
  const h_axis = cube.x || null;
  const v_axis = cube.y || null;
  const z_axis = cube.z || null;
  formProduct.horizontal_axis.bbox.x = h_axis.extent;
  formProduct.horizontal_axis.bbox.x_values = h_axis.values;
  formProduct.horizontal_axis.bbox.y = v_axis.extent;
  formProduct.horizontal_axis.bbox.y_values = v_axis.values;
  formProduct.horizontal_axis.horizontal_crs = h_axis.reference_system;
  formProduct.horizontal_axis.unit_of_measure = h_axis.unit;
  formProduct.horizontal_axis.interpolation = h_axis.interpolation;
  formProduct.horizontal_axis.x_resolution = h_axis.step;
  formProduct.horizontal_axis.y_resolution = v_axis.step;
  formProduct.horizontal_axis.regular = h_axis.values === undefined;
  if (z_axis) {
    formProduct.vertical_axis.bbox = z_axis.extent || [];
    formProduct.vertical_axis.values = z_axis.values || [];
    formProduct.vertical_axis.vertical_crs = z_axis.reference_system;
    formProduct.vertical_axis.unit_of_measure = z_axis.unit;
    formProduct.vertical_axis.interpolation = z_axis.interpolation;
    formProduct.vertical_axis.resolution = z_axis.step;
    formProduct.vertical_axis.regular = z_axis.values === undefined;
  }

  Object.keys(cube)
    .filter((dim) => !["spatial", "temporal"].includes(cube[dim].type))
    .map((dim) => {
      formProduct.other_dims.push({
        name: dim,
        bbox: Array.isArray(cube[dim].extent) ? cube[dim].extent : [],
        values: cube[dim].values,
        reference_system: cube[dim].reference_system,
        unit_of_measure: cube[dim].unit,
        interpolation: cube[dim].interpolation,
        resolution: cube[dim].step,
        regular: cube[dim].values === undefined,
      });
    });

  let timeDim = cube.time || cube.t;
  if (timeDim) {
    let range =
      timeDim.extent &&
      Array.isArray(timeDim.extent) &&
      timeDim.extent.length === 2
        ? timeDim.extent
        : timeDim.values;
    range =
      range &&
      range.map((time) =>
        ![undefined, null].includes(time) && typeof time === "string"
          ? time.replace("Z", "")
          : time
      );
    if (
      timeDim.extent &&
      Array.isArray(timeDim.extent) &&
      timeDim.extent.length === 2
    ) {
      formProduct.time_axis.bbox = range;
      formProduct.time_axis.regular = true;
    } else {
      formProduct.time_axis.values = range;
      formProduct.time_axis.regular = false;
    }
    formProduct.time_axis.unit_of_measure = timeDim.unit;
    formProduct.time_axis.interpolation = timeDim.interpolation;

    if (timeDim.step !== undefined) formProduct.time_axis.step = {};
    if (typeof timeDim.step === "string" && timeDim.step.startsWith("P")) {
      let parsedStep = parse(timeDim.step);
      formProduct.time_axis.step.Y = parsedStep.years;
      formProduct.time_axis.step.M = parsedStep.months;
      formProduct.time_axis.step.D = parsedStep.days;
      formProduct.time_axis.step.H = parsedStep.hours;
      formProduct.time_axis.step.Ms = parsedStep.minutes;
      formProduct.time_axis.step.S = parsedStep.seconds;
    }
  } else {
    formProduct.third.threeD = false;
  }

  const bands = stac.properties["raster:bands"];
  if (bands !== undefined && Array.isArray(bands))
    bands.map((band) => {
      formProduct.bands.push({
        band_name: band.band_name,
        unit: band.unit,
        data_type: band.data_type,
        nodata: band.nodata,
        definition: band.definition,
        description: band.description,
        category_list: band.category_list,
        comment: band.comment,
        interpolation: band.interpolation,
      });
    });

  formProduct.reprojection_axis.re_projection_crs =
    stac.properties.re_projection_crs;
  formProduct.reprojection_axis.unit_of_measure = stac.properties.unit;
  formProduct.reprojection_axis.resolution = stac.properties.resolution;

  formProduct.legal.license = stac.properties.license;
  if (stac.properties.license === "proprietary") {
    stac.links
      .filter((link) => link.rel === "license")
      .map((link) => (formProduct.legal.license_link = link.href));
  }
  formProduct.legal.personalData = stac.properties.personalData;
  formProduct.provenance_name = stac.properties.provenance_name;
  formProduct.preprocessing = stac.properties.preprocessing;
  formProduct.source_data = stac.properties.source_data;
  formProduct.models = stac.properties.models;
  formProduct.data_quality = stac.properties.data_quality;
  formProduct.quality_control = stac.properties.quality_control;
  formProduct.metada_standards = stac.properties.metada_standards;
  formProduct.distributions = stac.properties.distributions;
  formProduct.access_control = stac.properties.access_control;

  formProduct.provision = stac.properties.provision
    ? stac.properties.provision.replace("Z", "")
    : null;
  formProduct.modification = stac.properties.modification
    ? stac.properties.modification.replace("Z", "")
    : null;
  formProduct.datetime = stac.properties.datetime
    ? stac.properties.datetime.replace("Z", "")
    : null;

  formProduct.use_case_S4E = stac.properties.use_case_S4E;
  formProduct.use_case_WER = stac.properties.use_case_WER;
  formProduct.use_case_NHM = stac.properties.use_case_NHM;
  formProduct.use_case_NILU = stac.properties.use_case_NILU;
  formProduct.use_case_NHM_2 = stac.properties.use_case_NHM_2;
  formProduct.ingestion_status = stac.properties.ingestion_status;

  formProduct.platform = stac.properties.platform;
  formProduct.state = "edited";
  return formProduct;
};

const formToStac = (formProduct) => {
  let stac = {
    type: "Feature",
    stac_version: "1.0.0",
    id: "",
    properties: {
      keywords: "",
      license: "",
      description: "",
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
      },
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
      organization_name: provider.organization_name,
      organization: provider.organization,
      comments: provider.comments,
      doc_link: provider.doc_link,
      organization_email: provider.organization_email,
      ORCID_ID: provider.ORCID_ID,
      roles: provider.roles,
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

  if (Array.isArray(formProduct.apis))
    formProduct.apis.map((api) => {
      stac.links.push({
        "example:container": !api.script,
        "example:language": api.language,
        type: api.language != "Multiple" ? languages[api.language] : null,
        title: api.title,
        description: api.description,
        href: api.href,
        rel: "example",
      });
    });
  stac.id = formProduct.identifier;
  stac.properties.title = formProduct.title;
  stac.properties.datasource_type = formProduct.datasource_type;
  stac.properties.dataSource = formProduct.dataSource;
  stac.properties.description = formProduct.description;
  stac.properties.area_cover = formProduct.general.area_cover;
  stac.properties.documentation = formProduct.documentation;
  stac.properties.crs = formProduct.general.crs;
  const cube = stac.properties["cube:dimensions"];
  const h_axis = cube.x || null;
  const v_axis = cube.y || null;
  cube.z = {};
  const z_axis = cube.z || null;

  formProduct.horizontal_axis.regular
    ? (h_axis.extent = formProduct.horizontal_axis.bbox.x)
    : (h_axis.values = formProduct.horizontal_axis.bbox.x_values);

  formProduct.horizontal_axis.regular
    ? (v_axis.extent = formProduct.horizontal_axis.bbox.y)
    : (v_axis.values = formProduct.horizontal_axis.y_values);

  h_axis.reference_system = formProduct.horizontal_axis.horizontal_crs;
  v_axis.reference_system = formProduct.horizontal_axis.horizontal_crs;
  h_axis.unit = formProduct.horizontal_axis.unit_of_measure;
  v_axis.unit = formProduct.horizontal_axis.unit_of_measure;
  v_axis.interpolation = formProduct.horizontal_axis.interpolation;
  h_axis.interpolation = formProduct.horizontal_axis.interpolation;
  h_axis.step = formProduct.horizontal_axis.x_resolution;
  v_axis.step = formProduct.horizontal_axis.y_resolution;

  formProduct.vertical_axis.regular
    ? (z_axis.extent = formProduct.vertical_axis.bbox)
    : (z_axis.values = formProduct.vertical_axis.values);

  z_axis.reference_system = formProduct.vertical_axis.vertical_crs;
  z_axis.unit = formProduct.vertical_axis.unit_of_measure;
  z_axis.interpolation = formProduct.vertical_axis.interpolation;
  z_axis.step = formProduct.vertical_axis.resolution;
  if (z_axis.extent !== undefined || z_axis.extent !== undefined) {
    z_axis.type = "spatial";
  }

  formProduct.other_dims.map((dim) => {
    cube[dim.name] = {
      name: dim.name,
      extent: dim.bbox || [],
      values: dim.values,
      reference_system: dim.reference_system,
      unit: dim.unit_of_measure,
      interpolation: dim.interpolation,
      step: dim.resolution,
    };
  });

  if (formProduct.horizontal_axis !== undefined) {
    let edges =
      Array.isArray(formProduct.horizontal_axis.bbox.x) &&
      Array.isArray(formProduct.horizontal_axis.bbox.y)
        ? [
            formProduct.horizontal_axis.bbox.x[0],
            formProduct.horizontal_axis.bbox.y[0],
            formProduct.horizontal_axis.bbox.x[1],
            formProduct.horizontal_axis.bbox.y[1],
          ]
        : [];
    let bbox_crs = formProduct.horizontal_axis.horizontal_crs;
    if (
      typeof bbox_crs === "string" &&
      bbox_crs.toLowerCase().startsWith("epsg:")
    ) {
      bbox_crs = bbox_crs.split(":")[1];
    }
    ![NaN, 4326, undefined].includes(bbox_crs)
      ? (stac.bbox = reprojectBoundingBox({
          bbox: edges,
          from: Number(bbox_crs),
          to: 4326,
        }))
      : (stac.bbox = edges);
    stac.geometry.coordinates = [
      [
        [stac.bbox[0], stac.bbox[1]],
        [stac.bbox[0], stac.bbox[3]],
        [stac.bbox[2], stac.bbox[3]],
        [stac.bbox[2], stac.bbox[1]],
        [stac.bbox[0], stac.bbox[1]],
      ],
    ];
  }

  if (formProduct.third.threeD === true) {
    let range =
      formProduct.time_axis.bbox !== undefined &&
      Array.isArray(formProduct.time_axis.bbox)
        ? formProduct.time_axis.bbox
        : formProduct.time_axis.values;
    if (range && Array.isArray(range)) {
      if ([undefined, null, ""].includes(range[1])) {
        range[1] = "2999-01-01T00:00:00";
      }
      if ([undefined, null, ""].includes(range[0])) {
        range[0] = "1900-01-01T00:00:00";
      }
    }

    if (range !== undefined) {
      cube.time = {
        type: "temporal",
      };
      range = range.map((time) =>
        ![undefined, null].includes(time) && typeof time === "string"
          ? (time = `${time}Z`)
          : time
      );
      stac.properties.start_datetime = range[0];
      stac.properties.end_datetime = range[range.length - 1];
    }

    let dates = "P";
    let hasDates = false;
    let times = "T";
    let hasTimes = false;
    formProduct.time_axis.step !== undefined &&
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
    cube.time.unit = formProduct.time_axis.unit_of_measure;
    cube.time.interpolation = formProduct.time_axis.interpolation;
  }
  const bands = formProduct.bands;
  let keywords =
    typeof formProduct.keywords === "string"
      ? formProduct.keywords.split(",")
      : [];
  if (bands !== undefined && Array.isArray(bands))
    bands.map((band) => {
      band.band_name && keywords.push(band.band_name);
      stac.properties["raster:bands"].push({
        band_name: band.band_name,
        unit: band.unit,
        data_type: band.data_type,
        nodata: band.nodata,
        definition: band.definition,
        description: band.description,
        category_list: band.category_list,
        comment: band.comment,
        interpolation: band.interpolation,
      });
    });

  stac.properties.re_projection_crs =
    formProduct.reprojection_axis.re_projection_crs;
  stac.properties.unit_of_measure =
    formProduct.reprojection_axis.unit_of_measure;
  stac.properties.resolution = formProduct.reprojection_axis.resolution;
  stac.properties.keywords = [...new Set([...keywords])];
  stac.properties.license = formProduct.legal.license;
  if (stac.properties.license === "proprietary") {
    stac.links.push({
      href: formProduct.legal.license_link,
      rel: "license",
      type: "text/xml",
      title: "Link to the item's license.",
    });
  } else {
    stac.links.filter((link) => link.rel != "license");
  }
  stac.properties.personalData = formProduct.legal.personalData;
  stac.properties.provenance_name = formProduct.provenance_name;
  stac.properties.preprocessing = formProduct.preprocessing;
  stac.properties.source_data = formProduct.source_data;
  stac.properties.models = formProduct.models;
  stac.properties.data_quality = formProduct.data_quality;
  stac.properties.quality_control = formProduct.quality_control;
  stac.properties.metada_standards = formProduct.metada_standards;

  stac.properties.distributions = formProduct.distributions;
  stac.properties.access_control = formProduct.access_control;

  let productTime = formProduct.datetime;
  stac.properties.datetime =
    ![undefined, null].includes(productTime) && typeof productTime === "string"
      ? (productTime = `${productTime}Z`)
      : productTime;
  stac.properties.modification =
    ![undefined, null].includes(formProduct.modification) &&
    typeof formProduct.modification === "string"
      ? (formProduct.modification = `${formProduct.modification}Z`)
      : formProduct.modification;
  stac.properties.provision =
    ![undefined, null].includes(formProduct.provision) &&
    typeof formProduct.provision === "string"
      ? (formProduct.provision = `${formProduct.provision}Z`)
      : formProduct.provision;

  stac.properties.use_case_S4E = formProduct.use_case_S4E;
  stac.properties.use_case_WER = formProduct.use_case_WER;
  stac.properties.use_case_NHM = formProduct.use_case_NHM;
  stac.properties.use_case_NILU = formProduct.use_case_NILU;
  stac.properties.use_case_NHM_2 = formProduct.use_case_NHM_2;
  stac.properties.ingestion_status = formProduct.ingestion_status;

  stac.properties.platform = formProduct.platform;
  const itemState = formProduct.state || "created";
  const reviewers =
    formProduct.platform === "Eox"
      ? ["eox-cs1"]
      : formProduct.platform === "Rasdaman"
      ? ["misev"]
      : formProduct.platform === "Both"
      ? ["misev", "eox-cs1"]
      : [];

  let timeRange = undefined;
  if (cube.time) {
    timeRange =
      cube.time.extent && cube.time.extent.length === 2
        ? cube.time.extent
        : cube.time.values;
  }
  const hasNoRasdamanLinks = (links) => {
    const remain = links.filter((link) =>
      [
        "Link to the description of this coverage object within the WCS Service",
        "Link to the rasdaman dashboard to Access, process gridded data",
        "Link to the main WCS service URI providing this data",
      ].includes(link.title)
    );
    return remain.length !== 2;
  };
  if (["Rasdaman", "Both"].includes(formProduct.platform)) {
    let wmsBbox = [stac.bbox[1], stac.bbox[0], stac.bbox[3], stac.bbox[2]];
    let hasNoNullValues =
      !wmsBbox.includes(undefined) && !wmsBbox.includes(null);
    if (hasNoNullValues) {
      let ThumbnailUrl = `https://catalog:JdpsUHpPoqXtbM3@fairicube.rasdaman.com/rasdaman/ows?service=WMS&version=1.3.0&request=GetMap&layers=${stac.id}&bbox=${wmsBbox}&width=800&height=600&crs=EPSG:4326&format=image/png&transparent=true&styles=`;
      if (timeRange !== undefined && Array.isArray(timeRange)) {
        ThumbnailUrl = ThumbnailUrl + `time="${timeRange[0]}"`;
      }
      stac.assets["thumbnail_rasdaman"] = {
        href: ThumbnailUrl,
        roles: ["thumbnail"],
      };
    }

    if (hasNoRasdamanLinks(stac.links)) {
      stac.links.push({
        href: `https://catalog:JdpsUHpPoqXtbM3@fairicube.rasdaman.com/rasdaman/ows?&SERVICE=WCS&VERSION=2.1.0&REQUEST=DescribeCoverage&COVERAGEID=${stac.id}&outputType=GeneralGridCoverage`,
        rel: "item",
        type: "text/xml",
        title:
          "Link to the description of this coverage object within the WCS Service",
      });
      stac.links.push({
        href: `https://fairicube.rasdaman.com/rasdaman-dashboard/?layers=${stac.id}`,
        rel: "alternate",
        type: "text/html",
        title: "Link to the rasdaman dashboard to Access, process gridded data",
      });
      stac.links.push({
        href: "https://catalog:JdpsUHpPoqXtbM3@fairicube.rasdaman.com/rasdaman/ows?&SERVICE=WCS&VERSION=2.1.0&REQUEST=GetCapabilities",
        rel: "collection",
        type: "text/xml",
        title: "Link to the main WCS service URI providing this data",
      });
    }
  }
  return {
    stac: stac,
    state: itemState,
    assignees: [formProduct.assignees],
    reviewers: reviewers,
  };
};

export { formToStac, stacToForm };
