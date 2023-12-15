<script setup>
import { ref, computed } from "vue";
import { Octokit } from "octokit";
import { dataTypes } from "./helpers/helpers";
import { stacToForm, formToStac } from "./helpers/converters";
import LazyList from "lazy-load-list/vue";
import licenses from "./helpers/licenses.json";

const config = useRuntimeConfig()

const filterText = ref("");
const filenameList = [];

const fetchList = async (list, returnList = []) => {
  const catalogItems = list.map(async (url) => {
    const itemCatalogRequest = await fetch(url);
    const itemCatalog = await itemCatalogRequest.json();
    returnList.push(itemCatalog);
  });
  await Promise.all(catalogItems);
  return returnList;
};



const owner = config.public.owner;
const repo = config.public.repo;
const server = config.public.apiBase;
const auth = config.public.authentication
const octokit = new Octokit({});
const branches = await octokit.request("GET /repos/{owner}/{repo}/branches", {
  owner: owner,
  repo: repo,
  state: "all",
  headers: {
    "X-GitHub-Api-Version": "2022-11-28",
  },
});

const list = await branches.data;

const prBranches = list.filter((item) => item.name != "main");

const result = async () => {
  let branchList = [];
  const results = prBranches.map(async (item) => {
    const commitURL = item.commit.url;
    const fileURL = await fetch(commitURL);
    const fileURLResponse = await fileURL.json();
    if (["added", "modified"].includes(fileURLResponse.files[0].status)) {
      const filename = fileURLResponse.files[0].filename;
      filenameList.push(filename.substr(10));
      const fileJSON = `https://raw.githubusercontent.com/${owner}/${repo}/${item.name}/${filename}`;
      branchList.push(fileJSON);
    }
  });
  await Promise.all(results);
  return fetchList(branchList);
};

const BranchData = await result();

const main = await fetch(
  `https://raw.githubusercontent.com/${owner}/${repo}/main/stac_dist/catalog.json`
);
const mainCatalog = await main.json();
const mainItemsLinks = [];
if (
  mainCatalog.links !== undefined &&
  Array.isArray(mainCatalog.links) === true
) {
  mainCatalog.links
    .filter(
      (item) =>
        item.rel === "item" &&
        filenameList.includes(item.href.substr(2)) === false
    )
    .map((item) => {
      let url = `https://raw.githubusercontent.com/${owner}/${repo}/main/stac_dist/${item.href.substr(
        2
      )}`;
      mainItemsLinks.push(url);
    });
}
const mainResults = await fetchList(mainItemsLinks);

const data = BranchData.concat(mainResults);

const filteredProduct = computed(() => {
  let filter = filterText.value;
  if (!filter.length) return data;
  return data.filter((item) =>
    item.id.toLowerCase().includes(filter.toLowerCase())
  );
});

/// TODO  need to set the initial values so that it could be edited from the server
let product = ref({});
const headers = useRequestHeaders()

const showList = ref(true);
const showForm = ref(false);
const editForm = (item) => {
  product = stacToForm(item);
  showForm.value = true;
  showList.value = false;
};
const createForm = () => {
  product = ref({});
  showForm.value = true;
  showList.value = false;
};
const backToList = () => {
  product = ref({});
  filterText.value = "";
  showForm.value = false;
  showList.value = true;
};
let licensesData = [{ label: "Other", value: "other" }];
const createLicenses = licenses.licenses.map((license) => {
  licensesData.push({ label: license.name, value: license.licenseId });
});
async function submit(values) {

  const submitStac = formToStac(values);

  const request = await fetch(`${server}/item-requests/stac_dist/${submitStac.stac.id}.json`, {
    method: "PUT",
    body: JSON.stringify(submitStac),
    headers: {
      "content-type": "application/json",
      "x-user": owner,
      "x-FairicubeOwner": true,
      "Authorization": headers.authorization
      // "Authorization": `Basic ${btoa(`${auth}`)}`

    },
  });
  if (await request.status === 200 ) {
    backToList()
  }

}
</script>

<template>
  <div class="github-issue-form">
    <img
      src="https://avatars.githubusercontent.com/u/108520563?s=200&v=4"
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
                {{ (item.properties && item.properties.title) || item.id }}
              </p>
              <FormKit
                type="button"
                label="Edit"
                suffix-icon="settings"
                style="background-color: gray"
                help=""
                @click="editForm(item)"
              />
            </div>
          </template>
        </LazyList>
      </ClientOnly>
    </div>
    <FormKit
      type="form"
      id="registration"
      v-model="product"
      #default="{ value }"
      @submit="submit"
      v-show="showForm"
    >
      <FormKit type="button" label="back" @click="backToList" />

      <FormKit
        type="text"
        name="title"
        label="Title"
        help="The title of the issue request"
      />
      <FormKit
        type="text"
        name="identifier"
        label="ID"
        help="The ID of the requested stac item"
      />
      <FormKit
        type="textarea"
        name="description"
        label="Description"
        help="Brief, nontechnical explanation of the datacube."
      />
      <FormKit
        type="text"
        name="datasource_type"
        label="Source Type"
        help="The data source type"
      />
      <FormKit
        type="list"
        dynamic
        #default="{ items, node, value }"
        name="assets"
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
              validation="required|url"
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
      <FormKit type="group" name="general">
        <h2 class="title">General</h2>
        <FormKit type="text" name="area_cover" label="total area cover" />
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
        <FormKit type="list" name="bbox" v-if="product.horizontal_axis.regular">
          <div class="bbox">
            <h4 class="title" style="padding: 0.5em">BBOX</h4>
            <br />
            <FormKit
              type="text"
              label="bottom lat"
              number
              validation=""
              placeholder="-180.0"
              help="lower latitude"
            />
            <FormKit
              type="text"
              label="top lat"
              number
              validation=""
              placeholder="180.0"
              help="top latitude"
            />
          </div>
        </FormKit>
        <FormKit
          type="text"
          name="values"
          label="values"
          v-if="!product.horizontal_axis.regular"
        />
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
          name="resolution"
          label="Resolution"
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
          placeholder="4326"
        />
        <FormKit type="checkbox" name="regular" label="regular ?" />
        <FormKit type="list" name="bbox" v-if="product.vertical_axis.regular">
          <div class="bbox">
            <h4 class="title" style="padding: 0.5em">Lower/Upper Bound</h4>
            <br />
            <FormKit
              type="text"
              label="bottom longitude"
              number
              validation=""
              help="lower bound"
            />
            <FormKit
              type="text"
              label="top longitude"
              number
              validation=""
              help="Upper bound"
            />
          </div>
        </FormKit>
        <FormKit
          type="text"
          name="values"
          label="values"
          v-if="!product.vertical_axis.regular"
        />
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

        <FormKit
          type="text"
          name="values"
          label="values"
          v-if="!product.time_axis.regular"
        />
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
            />
            <FormKit
              type="number"
              number
              min="0"
              max="12"
              step="1"
              name="M"
              label="Months"
            />
            <FormKit
              type="number"
              min="0"
              max="30"
              step="1"
              number
              name="D"
              label="Days"
            />
            <FormKit
              type="number"
              number
              min="0"
              max="24"
              step="1"
              name="H"
              label="Hours"
            />
            <FormKit
              type="number"
              min="0"
              max="60"
              step="1"
              number
              name="Ms"
              label="Minutes"
            />
            <FormKit
              type="number"
              min="0"
              max="60"
              step="1"
              number
              name="S"
              label="Seconds"
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
                  validation=""
                  help="Upper bound"
                />
                <FormKit
                  type="text"
                  label="bottom left long"
                  number
                  validation=""
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
        <FormKit type="text" name="Provenance_name" label="Provenance name" />
        <FormKit type="text" name="keywords" label="Keywords" />
        <FormKit
          type="datetime-local"
          step="1"
          label="begin time"
          name="datetime"
        />
      </FormKit>
      <FormKit
        type="checkbox"
        name="use_case_S4E"
        label="Priority (Climate change (S4E))"
        :options="{
          one: 'One',
          two: 'Two',
        }"
      />
      <FormKit
        type="checkbox"
        name="use_case_WER"
        label="Biodiversity & agri (WER)"
        :options="{
          one: 'One',
          two: 'Two',
        }"
      />
      <FormKit
        type="checkbox"
        name="use_case_NHM"
        label="Biodiversity occurrence cubes (NHM)"
        :options="{
          one: 'One',
          two: 'Two',
        }"
      />
      <FormKit
        type="checkbox"
        name="use_case_NILU"
        label="Neighbourhood building stock (NILU)"
        :options="{
          one: 'One',
          two: 'Two',
        }"
      />
      <FormKit
        type="checkbox"
        name="platform"
        label="Target Platform"
        :options="{
          eox: 'EOX',
          rasdaman: 'rasdaman',
          other: 'Other',
        }"
        validation="required|min:1"
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
      <!-- <pre>{{ value }}</pre> -->
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
button {
  align-self: flex-start;
}
</style>
