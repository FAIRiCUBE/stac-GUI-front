<script setup>
import { ref, computed } from "vue";
import { dataTypes } from "./helpers/helpers";
import { stacToForm, formToStac } from "./helpers/converters";
import LazyList from "lazy-load-list/vue";
import licenses from "./helpers/licenses.json";
import { FormKitIcon } from "@formkit/vue";
import { vAutoAnimate } from "@formkit/auto-animate";

const config = useRuntimeConfig();

const filterText = ref("");

const owner = config.public.owner;

const items = await useFetch("/api/item-requests/items", {
  headers: {
    "content-type": "application/json",
    "x-user": owner,
    "x-FairicubeOwner": true,
  },
});
const itemsList = items.data._rawValue;
const data = itemsList.items;
const members = itemsList.members;
let itemsIdentifiers = [];
data.map((item) => itemsIdentifiers.push(item.name));

const filteredProduct = computed(() => {
  let filter = filterText.value;
  if (!filter.length) return data;
  return data.filter((item) =>
    item.name.toLowerCase().includes(filter.toLowerCase())
  );
});

/// TODO  need to set the initial values so that it could be edited from the server
let product = ref({});

const stacIsNew = ref(true);
const showList = ref(true);
const showModal = ref(false);
const showBackModal = ref(false);
const showBboxError = ref(false);
const showForm = ref(false);
const editForm = async (item) => {
  const itemData = await useFetch(
    `/api/item-requests/${item.name}`,
    {
      method: "POST",
      body: JSON.stringify({ item }),
      headers: {
        "content-type": "application/json",
        "x-user": owner,
        "x-FairicubeOwner": true,
      },
    }
  );
  const stacData = itemData.data._rawValue.stac;
  product = stacToForm(stacData);
  product.members = members;
  product.assignees = JSON.parse(JSON.stringify(item)).assignees;
  stacIsNew.value = false;
  showForm.value = true;
  showList.value = false;
};
const createForm = () => {
  product = ref({
    horizontal_axis: {
      regular: true,
    },
    vertical_axis: {
      regular: true,
    },
    time_axis: {
      regular: true,
    },
  });
  stacIsNew.value = true;
  showForm.value = true;
  showList.value = false;
};

const backToList = () => {
  product = ref({});
  filterText.value = "";
  showBackModal.value = false;
  showForm.value = false;
  showList.value = true;
};
const closeModal = () => {
  showModal.value = false;
  location.reload();
};
const openBackModal = () => {
  showBackModal.value = true;
};
const closeBackModal = () => {
  showBackModal.value = false;
  location.reload();
};
const cancelBackModel = () => {
  showBackModal.value = false;
};

const cancelBboxModel = () => {
  showBboxError.value = false;
};

const useGlobeBound = (values) => {
  showBboxError.value = false;
  let formItems =
    product.value && typeof product.value == "object" ? product.value : product;
  formItems.horizontal_axis.bbox.x[0] = -180;
  formItems.horizontal_axis.bbox.y[0] = -90;
  formItems.horizontal_axis.bbox.x[1] = 180;
  formItems.horizontal_axis.bbox.y[1] = 90;
  formItems.horizontal_axis.horizontal_crs = 4326;
  submit(formItems);
};
const identifier_exists = ({ value }) => {
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(!stacIsNew.value || !itemsIdentifiers.includes(value)),
      200
    );
  });
};
const distinct = (node) =>
  !node.value.includes("/") && !node.value.includes(" ");
let licensesData = [{ label: "Other", value: "other" }];
const createLicenses = licenses.licenses.map((license) => {
  licensesData.push({ label: license.name, value: license.licenseId });
});
async function submit(values) {
  if (values.horizontal_axis.regular) {
    if (values.horizontal_axis.bbox === undefined) {
      values.horizontal_axis.bbox = { x: [null, null], y: [null, null] };
    }
    let submittedBbox = [
      values.horizontal_axis.bbox.x[0],
      values.horizontal_axis.bbox.y[0],
      values.horizontal_axis.bbox.x[1],
      values.horizontal_axis.bbox.y[1],
    ];
    let hasNoNullValues =
      !submittedBbox.includes(undefined) && !submittedBbox.includes(null);
    if (!hasNoNullValues) {
      showBboxError.value = true;
      return;
    }
  }

  const submitStac = formToStac(values);

  const request = await useFetch(
    `/api/item-requests/stac_dist/${submitStac.stac.id}.json`,
    {
      onRequest({ req, options }) {
        options.method = "PUT";
        options.body = JSON.stringify(submitStac);
        options.headers = {
          "content-type": "application/json",
          "x-user": owner,
          "x-FairicubeOwner": true,
        };
      },
      onResponse({ req, response }) {
        if (response.status === 200) {
          showModal.value = true;
          // backToList();
        }
      },
      onResponseError({ req, response }) {
        // Handle the response errors
      },
    }
  );
}
</script>

<template>
  <div class="modal-overlay title" v-show="showModal">
    <div class="modal">
      <img
        class="check"
        src="https://fairicube.nilu.no/wp-content/uploads/sites/21/2022/09/fairicube_logo_footer_400x297.png"
        alt=""
      />
      <img
        class="check"
        src="~/assets/img/check.png"
        style="max-width: 50% !important"
        alt=""
      />
      <p>Successfully submitted STAC data</p>
      <FormKit
        type="button"
        label="Close"
        style="background-color: gray"
        @click="closeModal"
      />
    </div>
  </div>
  <div class="modal-overlay title" v-show="showBboxError">
    <div class="modal" style="height: 300px">
      <img
        class="check"
        src="~/assets/img/warning.png"
        style="size: 50%"
        alt=""
      />
      <h6>WARNING</h6>
      <p>
        Projection error!, please check input bbox values. by clicking continue,
        Global world bounds in WGS84 will be used in the generated STAC item.
      </p>
      <div style="display: flex">
        <FormKit
          type="button"
          label="Continue"
          style="background-color: gray"
          @click="useGlobeBound"
        />
        <FormKit
          type="button"
          label="Cancel"
          style="background-color: gray"
          @click="cancelBboxModel"
        />
      </div>
    </div>
  </div>
  <div class="modal-overlay title" v-show="showBackModal">
    <div class="modal" style="height: 300px">
      <img
        class="check"
        src="~/assets/img/warning.png"
        style="size: 50%"
        alt=""
      />
      <h6>WARNING</h6>
      <p>By clicking the Back-Button, all recent changes will be lost!</p>
      <div style="display: flex">
        <FormKit
          type="button"
          label="Back"
          style="background-color: Red"
          @click="backToList"
        />
        <FormKit
          type="button"
          label="Cancel"
          style="background-color: gray"
          @click="cancelBackModel"
        />
      </div>
    </div>
  </div>
  <div class="github-issue-form">
    <img
      src="https://fairicube.nilu.no/wp-content/uploads/sites/21/2022/09/fairicube_logo_footer_400x297.png"
      alt="Fairicube Logo"
      width="244"
      height="50"
      class="logo"
    />
    <div class="github-issue-form" v-show="showList">
      <div class="bbox" style="align-items: flex-end">
        <FormKit
          type="search"
          placeholder="Filter products"
          label="Search"
          v-model="filterText"
        />
        <FormKit
          type="button"
          label="New"
          style="background-color: green"
          @click="createForm"
        />
      </div>
      <ClientOnly>
        <LazyList
          :data="filteredProduct"
          :itemsPerRender="150"
          containerClasses="list"
          defaultLoadingColor="#222"
        >
          <template v-slot="{ item }">
            <div
              class="bbox"
              style="align-items: baseline; flex-direction: row-reverse"
            >
              <p class="title" style="min-width: fit-content">
                {{ item.name }}
              </p>
              <div style="display: flex">
                <FormKit
                  type="button"
                  label="Edit"
                  suffix-icon="settings"
                  style="background-color: gray"
                  help=""
                  @click="editForm(item)"
                />

                <a :href="item.pull" target="_blank" rel="noopener noreferrer">
                  <FormKit
                    v-if="item.pull"
                    type="button"
                    label="link"
                    suffix-icon="github"
                    style="background-color: black; max-width: inherit"
                    help=""
                  />
                </a>
              </div>
            </div>
          </template>
        </LazyList>
      </ClientOnly>
    </div>
    <FormKit
      type="form"
      id="registration"
      @submit="submit"
      v-model="product"
      #default="{ value, state: { dirty } }"
      v-show="showForm"
      dirty-behavior="compare"
      :actions="false"
    >
      <FormKit type="button" label="back" @click="openBackModal" />
      <FormKit
        type="radio"
        name="platform"
        label="Target Platform"
        :options="{
          Eox: 'EOX',
          Rasdaman: 'rasdaman',
          Both: 'Both',
        }"
        validation="required"
      />
      <h2 class="title">General</h2>
      <FormKit
        type="text"
        name="title"
        label="Title"
        help="The title of the issue request"
        validation="required"
      />
      <FormKit
        :disabled="!stacIsNew"
        type="text"
        name="identifier"
        label="ID"
        help="The ID of the requested stac item"
        :validation-rules="{ identifier_exists, distinct }"
        :validation-messages="{
          identifier_exists:
            'Sorry, this Id is duplicated. please Try another one.',
          distinct: 'ID value must not contain spaces or slash (/) characters',
        }"
        validation="required | (500)identifier_exists | distinct"
      />

      <FormKit
        type="textarea"
        name="description"
        label="Description"
        help="Brief, nontechnical explanation of the datacube."
      />
      <FormKit
        type="text"
        name="dataSource"
        label="Data Source"
      />
      <FormKit
        type="text"
        name="datasource_type"
        label="Source Type"
        help="The data source type"
      />
      <FormKit type="group" name="general">
        <FormKit type="text" name="area_cover" label="total area cover" />
        <FormKit
          type="text"
          name="crs"
          help="reference system number in EPSG format e.g(4326)"
          label="CRS"
        />
      </FormKit>
      <FormKit
        type="list"
        dynamic
        #default="{ items, node, value }"
        name="assets"
        v-if="product.platform !== 'Rasdaman'"
      >
        <h2 class="title">Assets</h2>
        <FormKit
          type="group"
          v-for="(item, index) in items"
          :key="item"
          :index="index"
        >
          <div class="group">
            <FormKit
              type="url"
              label="Source"
              name="href"
              placeholder="https://www.example.com..."
              help="The link to the source of the dataset."
            />
            <FormKit
              type="text"
              name="name"
              label="name"
              help="The name of the data asset"
            />
            <FormKit
              type="button"
              label="Remove"
              style="background-color: red"
              help="remove asset"
              @click="() => node.input(value.filter((_, i) => i !== index))"
            />
          </div>
        </FormKit>
        <FormKit
          type="button"
          label="+ Add asset"
          help="Add another data asset"
          @click="() => node.input(value.concat({}))"
        />
      </FormKit>

      <FormKit
        type="list"
        dynamic
        #default="{ items, node, value }"
        name="providers"
      >
        <h2 class="title">Organizations</h2>
        <FormKit
          type="group"
          v-for="(item, index) in items"
          :key="item"
          :index="index"
        >
          <div class="group">
            <FormKit
              type="text"
              name="organization"
              label="Organization"
              help="The name of the organization which produced the dataset."
            />
            <FormKit
              type="text"
              name="organization_name"
              label="Name"
              help="The name of the organization which produced the dataset."
            />
            <FormKit
              type="text"
              name="organization_email"
              label="Email"
              help="The email of the organization which produced the dataset."
            />
            <FormKit
              type="text"
              name="ORCID_ID"
              label="ORCID ID"
              help="ORCID ID"
            />
            <FormKit
              type="text"
              name="project_purpose"
              label="Project Purpose"
            />
            <FormKit
              type="url"
              label="Documentation Link"
              name="doc_link"
              placeholder="https://www.example.com..."
              validation="url"
            />
            <FormKit type="textarea" name="comments" label="Comments" />
            <FormKit
              type="button"
              label="Remove"
              style="background-color: red"
              help="remove organization"
              @click="() => node.input(value.filter((_, i) => i !== index))"
            />
          </div>
        </FormKit>
        <FormKit
          type="button"
          label="+ Add Organizations"
          help="Add another band"
          @click="() => node.input(value.concat({}))"
        />
      </FormKit>
      <FormKit type="group" name="horizontal_axis">
        <h2 class="title">Horizontal Axis</h2>
        <FormKit
          type="text"
          name="horizontal_crs"
          label="Horizontal CRS"
          help="reference system number in EPSG format e.g(4326)"
          placeholder="4326"
        />
        <FormKit type="checkbox" name="regular" label="regular ?" />
        <FormKit type="group" name="bbox">
          <FormKit type="list" name="x">
            <div class="bbox">
              <h4 class="title" style="padding: 0.5em">BBOX</h4>
              <br />
              <FormKit
                type="text"
                label="bottom x bound"
                number
                validation="number"
                placeholder="-180.0"
                help="West Bound"
              />
              <FormKit
                type="text"
                label="upper x bound"
                number
                validation="number"
                placeholder="180.0"
                help="East Boound"
              />
            </div>
          </FormKit>
          <FormKit type="list" name="y">
            <div class="bbox">
              <h4 class="title" style="padding: 0.5em">BBOX</h4>
              <br />
              <FormKit
                type="text"
                label="bottom y bound"
                number
                validation="number"
                placeholder="-90.0"
                help="South Bound"
              />
              <FormKit
                type="text"
                label="upper y bound"
                number
                validation="number"
                placeholder="90.0"
                help="North Bound"
              />
            </div>
          </FormKit>
          <FormKit
            type="text"
            name="x_values"
            label="X values"
            v-if="!product.horizontal_axis.regular"
          />
          <FormKit
            type="text"
            name="y_values"
            label="Y values"
            v-if="!product.horizontal_axis.regular"
          />
        </FormKit>

        <FormKit
          type="text"
          name="unit_of_measure"
          label="Unit of Measure"
          placeholder="degree"
        />
        <FormKit
          type="text"
          name="interpolation"
          label="Interpolation/Aggregation"
        />
        <FormKit
          type="text"
          name="x_resolution"
          label="X Resolution"
          help="Resolution (or 'irregular'). Should be 1 value as required by UC, not all resolutions of dataset"
        />
        <FormKit
          type="text"
          name="y_resolution"
          label="Y Resolution"
          help="Resolution (or 'irregular'). Should be 1 value as required by UC, not all resolutions of dataset"
        />
      </FormKit>
      <FormKit type="group" name="vertical_axis">
        <h2 class="title">Vertical Axis</h2>
        <FormKit
          type="text"
          name="vertical_crs"
          label="Vertical CRS"
          help="reference system number in EPSG format e.g(4326)"
          placeholder="3855"
        />
        <FormKit type="checkbox" name="regular" label="regular ?" />
        <FormKit type="list" name="bbox" v-if="product.vertical_axis.regular">
          <div class="bbox">
            <h4 class="title" style="padding: 0.5em">Lower/Upper Bound</h4>
            <br />
            <FormKit
              type="text"
              label="bottom bound"
              number
              validation="number"
              help="lower bound"
            />
            <FormKit
              type="text"
              label="top bound"
              number
              validation="number"
              help="Upper bound"
            />
          </div>
        </FormKit>
        <FormKit
          type="text"
          name="values"
          label="Vertical axis values"
          v-if="!product.vertical_axis.regular"
        />
        <FormKit
          type="text"
          name="unit_of_measure"
          label="Unit of Measure"
          placeholder="Meters"
        />
        <FormKit
          type="text"
          name="interpolation"
          label="Interpolation/Aggregation"
        />
        <FormKit
          type="text"
          name="resolution"
          label="Resolution"
          help="Resolution (or 'irregular'). Should be 1 value as required by UC, not all resolutions of dataset"
        />
      </FormKit>
      <FormKit type="group" name="time_axis">
        <h2 class="title">Time Axis</h2>
        <FormKit type="checkbox" name="regular" label="regular ?" />

        <FormKit type="list" name="bbox" v-if="product.time_axis.regular">
          <div class="bbox">
            <h4 class="title" style="padding: 0.5em; padding-top: 0.5em">
              Lower/Upper Bound
            </h4>
            <br />
            <FormKit
              type="datetime-local"
              label="begin time"
              step="1"
              validation=""
            />
            <FormKit
              type="datetime-local"
              label="end time"
              step="1"
              validation=""
            />
          </div>
        </FormKit>

        <div v-auto-animate>
          <FormKit
            label="Values"
            name="values"
            type="list"
            dynamic
            #default="{ node, items, value }"
            v-if="!product.time_axis.regular"
          >
            <div v-for="(item, index) in items" :key="item" class="todo">
              <FormKit
                type="datetime-local"
                step="1"
                style="max-width: fit-content"
                name="datetime"
                :index="index"
              />
              <ul class="controls">
                <li>
                  <button
                    type="button"
                    @click="
                      () => node.input(value.filter((_, i) => i !== index))
                    "
                    class="button close"
                  >
                    <FormKitIcon icon="close" />
                  </button>
                </li>
              </ul>
            </div>
            <FormKit
              type="button"
              style="background-color: gray"
              @click="() => node.input(value.concat({}))"
              >+</FormKit
            >
          </FormKit>
        </div>
        <FormKit
          type="text"
          name="unit_of_measure"
          label="Unit of Measure"
          placeholder="minute"
        />
        <FormKit
          type="text"
          name="interpolation"
          label="Interpolation/Aggregation"
        />
        <h4 class="title" style="padding: 0.5em; padding-top: 0.5em">
          Resolution
        </h4>
        <div style="display: flex; flex-wrap: nowrap">
          <FormKit
            type="group"
            name="step"
            label="Resolution"
            help="Resolution (or 'irregular'). Should be 1 value as required by UC, not all resolutions of dataset"
          >
            <FormKit
              type="number"
              number
              min="0"
              max="100"
              step="1"
              name="Y"
              label="Years"
              validation="number"
            />
            <FormKit
              type="number"
              number
              min="0"
              max="12"
              step="1"
              name="M"
              label="Months"
              validation="number"
            />
            <FormKit
              type="number"
              min="0"
              max="30"
              step="1"
              number
              name="D"
              label="Days"
              validation="number"
            />
            <FormKit
              type="number"
              number
              min="0"
              max="24"
              step="1"
              name="H"
              label="Hours"
              validation="number"
            />
            <FormKit
              type="number"
              min="0"
              max="60"
              step="1"
              number
              name="Ms"
              label="Minutes"
              validation="number"
            />
            <FormKit
              type="number"
              min="0"
              max="60"
              step="1"
              number
              name="S"
              label="Seconds"
              validation="number"
            />
          </FormKit>
        </div>
      </FormKit>
      <FormKit
        type="list"
        dynamic
        #default="{ items, node, value }"
        name="other_dims"
      >
        <h2 class="title">Other Axis</h2>
        <FormKit
          type="group"
          v-for="(item, index) in items"
          :key="item"
          :index="index"
        >
          <div class="group">
            <FormKit
              type="text"
              name="name"
              label="Name"
              help="name of the dimension"
            />
            <FormKit
              type="text"
              name="crs"
              label="CRS"
              help="reference system number in EPSG format e.g(4326)"
              placeholder="4326"
            />
            <FormKit type="checkbox" name="regular" label="regular ?" />
            <FormKit type="list" name="bbox">
              <div class="bbox">
                <h4 class="title" style="padding: 0.5em">Lower/Upper Bound</h4>
                <br />
                <FormKit
                  type="text"
                  label="bottom left lat"
                  number
                  validation="number"
                  help="Upper bound"
                />
                <FormKit
                  type="text"
                  label="bottom left long"
                  number
                  validation="number"
                  help="lower bound"
                />
              </div>
            </FormKit>
            <FormKit
              type="text"
              name="unit_of_measure"
              label="Unit of Measure"
              placeholder="degree"
            />
            <FormKit
              type="text"
              name="values"
              label="values"
              v-if="!value[index].regular"
            />
            <FormKit
              type="text"
              name="interpolation"
              label="Interpolation/Aggregation"
            />
            <FormKit
              type="text"
              name="resolution"
              label="Resolution"
              help="Resolution (or 'irregular'). Should be 1 value as required by UC, not all resolutions of dataset"
            />
            <FormKit
              type="button"
              label="Remove"
              style="background-color: red"
              help="remove the extra dimension(Axis)"
              @click="() => node.input(value.filter((_, i) => i !== index))"
            />
          </div>
        </FormKit>
        <FormKit
          type="button"
          label="+ Add another"
          help="Add another dimension(Axis)"
          @click="() => node.input(value.concat({}))"
        />
      </FormKit>
      <FormKit
        type="list"
        dynamic
        #default="{ items, node, value }"
        name="bands"
      >
        <h2 class="title">Bands</h2>
        <FormKit
          type="group"
          v-for="(item, index) in items"
          :key="item"
          :index="index"
        >
          <div class="group" style="display: flex; flex-wrap: wrap">
            <FormKit type="text" name="band_name" label="cell components" />
            <FormKit type="text" name="unit" label="Unit of Measure" />
            <FormKit
              label="Data Type"
              type="select"
              name="data_type"
              placeholder="Select a data type"
              :options="dataTypes"
            />
            <FormKit type="text" number name="nodata" label="Null values" />
            <FormKit type="textarea" name="definition" label="Definition" />
            <FormKit type="textarea" name="description" label="Description" />
            <FormKit type="text" name="category_list" label="Category List" />
            <FormKit type="textarea" name="comment" label="Comment" />
            <FormKit type="text" name="interpolation" label="Interpolation" />

            <FormKit
              type="button"
              label="Remove"
              style="background-color: red"
              help="remove band"
              @click="() => node.input(value.filter((_, i) => i !== index))"
            />
          </div>
        </FormKit>
        <FormKit
          type="button"
          label="+ Add bands"
          help="Add another band"
          @click="() => node.input(value.concat({}))"
        />
      </FormKit>
      <FormKit type="group" name="reprojection_axis">
        <h2 class="title">Re-projection axis</h2>
        <FormKit
          type="text"
          name="re_projection_crs"
          label="Re-projection CRS"
          help="reference system number in EPSG format e.g(4326)"
          placeholder="4326"
        />
        <FormKit type="text" name="unit_of_measure" label="Unit of Measure" />
        <FormKit type="text" name="resolution" label="Resolution" />
      </FormKit>
      <FormKit type="group" name="legal">
        <h2 class="title">Legal</h2>
        <FormKit
          label="License"
          type="select"
          placeholder="Select a license"
          name="license"
          :options="licensesData"
        />
        <FormKit type="text" name="personalData" label="Personal Data" />
      </FormKit>
      <h2 class="title">Keywords</h2>
      <FormKit type="text" name="keywords" label="Keywords" />
      <h2 class="title">Provenance</h2>
      <FormKit type="text" name="Provenance_name" label="Origin" />
      <FormKit
        type="text"
        name="documentation"
        label="Documents & publications"
      />
      <FormKit
        type="text"
        name="preprocessing"
        label="Preprocessing (description)"
      />
      <FormKit type="url" name="source_data" label="Source Data (links)" />
      <FormKit type="url" name="models" label="Models (Links)" />
      <h2 class="title">Data Quality</h2>
      <FormKit type="text" name="data_quality" label="Data Quality" />
      <FormKit type="text" name="quality_control" label="Quality control" />
      <h2 class="title">Accessibility</h2>
      <FormKit
        type="text"
        name="metada_standards"
        label="(Meta)data standers"
      />
      <FormKit type="text" name="apis" label="APIs" />
      <FormKit type="text" name="distributions" label="Distributions" />
      <FormKit type="text" name="access_control" label="Access control" />

      <h2 class="title">Dates</h2>
      <FormKit
        type="datetime-local"
        step="1"
        label="Creation"
        name="datetime"
      />
      <FormKit
        type="datetime-local"
        step="1"
        label="Provision"
        name="provision"
      />
      <FormKit
        type="datetime-local"
        step="1"
        label="Modification"
        name="modification"
      />
      <h2 class="title">Internal</h2>
      <FormKit
        type="radio"
        name="use_case_S4E"
        label="Priority (Climate change (S4E))"
        :options="{
          1: 'One',
          2: 'Two',
        }"
      />
      <FormKit
        type="radio"
        name="use_case_WER"
        label="Biodiversity & agri (WER)"
        :options="{
          1: 'One',
          2: 'Two',
        }"
      />
      <FormKit
        type="radio"
        name="use_case_NHM"
        label="Biodiversity occurrence cubes (NHM)"
        :options="{
          1: 'One',
          2: 'Two',
        }"
      />
      <FormKit
        type="radio"
        name="use_case_NILU"
        label="Neighbourhood building stock (NILU)"
        :options="{
          1: 'One',
          2: 'Two',
        }"
      />
      <FormKit
        type="radio"
        name="use_case_NHM_2"
        label="Drosophila Genetics (NHM)"
        :options="{
          1: 'One',
          2: 'Two',
        }"
      />
      <FormKit
        type="text"
        name="ingestion_status"
        label="Ingestion Status (rasdaman)"
      />
      <FormKit
        type="list"
        dynamic
        #default="{ items, node, value }"
        name="thumbnails"
        v-if="product.platform !== 'Rasdaman'"
      >
        <h2 class="title">Thumbnails</h2>
        <FormKit
          type="group"
          v-for="(item, index) in items"
          :key="item"
          :index="index"
        >
          <div class="group">
            <FormKit
              type="url"
              label="Source"
              name="href"
              placeholder="https://www.example.com..."
              help="The link to the source of the thumbnail."
            />
            <FormKit
              type="text"
              name="name"
              label="name"
              help="The name of the thumbnail"
            />
            <FormKit
              type="button"
              label="Remove"
              style="background-color: red"
              help="remove thumbnail"
              @click="() => node.input(value.filter((_, i) => i !== index))"
            />
          </div>
        </FormKit>
        <FormKit
          type="button"
          label="+ Add thumbnails"
          help="Add another thumbnail"
          @click="() => node.input(value.concat({}))"
        />
      </FormKit>
      <FormKit
        type="select"
        label="Assignees"
        name="assignees"
        placeholder="Select an assignee"
        :options="members"
        help="Select your Github name from the list to be assigned. "
      />
      <FormKit
        type="submit"
        @submit="submit"
        label="submit"
        :disabled="!dirty"
      />
      <!-- <pre>{{ dirty }}</pre> -->
    </FormKit>
  </div>
</template>

<style scoped>
.github-issue-form {
  width: calc(100% - 2em);
  max-width: 1000px;
  box-sizing: border-box;
  padding: 2em;
  box-shadow: 0 0 2em rgba(0, 0, 0, 0.1);
  border-radius: 0.5em;
  margin: 4em auto;
}

.title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
}
.logo {
  width: 150px;
  height: auto;
  display: block;
  margin: 0 auto 2em auto;
}
pre {
  background-color: rgba(0, 100, 250, 0.1);
  padding: 1em;
}
@media (min-width: 400px) {
  .bbox {
    display: flex;
    justify-content: space-between;
  }

  .bbox > .formkit-outer {
    width: calc(50% - 0.5em);
  }
}
.formkit-remove {
  position: absolute;
  left: calc(100% + 0.5em);
  color: red;
  font-size: 0.75em;
}
.modal-overlay {
  position: fixed;
  z-index: 1000 !important;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  background-color: #000000da;
}

.modal {
  display: flex;
  flex-direction: column;
  align-content: stretch;
  justify-content: space-evenly;
  align-items: center;
  text-align: center;
  background-color: white;
  height: 500px;
  width: 500px;
  margin-top: 10%;
  padding: 60px 0;
  border-radius: 20px;
}
.check {
  width: 150px;
}
.controls {
  list-style-type: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
}
.todo {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  max-width: fit-content;
}
.todo:deep(.formkit-outer) {
  margin-bottom: 0;
  flex-grow: 1;
}
.controls {
  list-style-type: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
}
.controls .button {
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  color: #999;
  line-height: 1;
  transition: color 0.3s ease;
  appearance: none;
  font-size: 1em;
  color: var(--fk-color-primary);
  margin-left: 0.5rem;
}
.controls:deep(svg) {
  display: block;
  width: 1em;
  max-height: 1.25em;
  height: auto;
  font-size: larger;
  fill: currentColor;
}
.controls .close {
  color: var(--fk-color-danger);
}

h6 {
  font-weight: 500;
  font-size: 28px;
  margin: 20px 0;
}

p {
  font-size: 16px;
  margin: 20px 0;
}
button {
  align-self: flex-start;
}
</style>
