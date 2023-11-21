<script setup>
import { ref, computed } from 'vue'
import { Octokit } from "octokit"
import {dataTypes} from './helpers/helpers'
import LazyList from 'lazy-load-list/vue'
import licenses from './helpers/licenses.json'


const filterText = ref("")
const filenameList = []

const fetchList = async (list, returnList=[]) => {
  const catalogItems = list.map(async url => {
    const itemCatalogRequest = await fetch(url)
    const itemCatalog = await itemCatalogRequest.json()
    returnList.push(itemCatalog)
  })
  await Promise.all(catalogItems)
  return returnList

}

// providing the list directly from stac-fastapi
// const result = await fetch("https://stacapi.eoxhub.fairicube.eu/collections/index/items?limit=200");

// const data = await result.json();

//TODO: remove stat:'all', the following part should be continued after the wor on the backend is over.
const octokit = new Octokit({});
const branches = await octokit.request('GET /repos/{owner}/{repo}/branches', {
  owner: 'FAIRICUBE',
  repo: 'data-requests',
  state:'all',
  headers: {
    'X-GitHub-Api-Version': '2022-11-28'
  }
})

const list = await branches.data



const prBranches = list.filter(item => item.name != "main")


const result = async () =>{
  let branchList = []
  const results = prBranches.map(async item => {
    const commitURL = item.commit.url
    const fileURL = await fetch(commitURL)
    const fileURLResponse = await fileURL.json()
    if (fileURLResponse.files[0].status === "added") {
      const filename  = fileURLResponse.files[0].filename
      filenameList.push(filename.substr(10))
    const fileJSON = `https://raw.githubusercontent.com/FAIRiCUBE/data-requests/${item.name}/${filename}`
    branchList.push(fileJSON)
    }
  })
  await Promise.all(results)
  return fetchList(branchList)

}

const BranchData = await result()

const main = await fetch("https://raw.githubusercontent.com/FAIRiCUBE/data-requests/main/stac_dist/catalog.json")
const mainCatalog = await main.json();
const mainItemsLinks = []
if (mainCatalog.links !== undefined && Array.isArray(mainCatalog.links) === true) {
  mainCatalog.links.filter(item => item.rel === "item" && filenameList.includes(item.href.substr(2)) === false)
  .map(item => {
      let url = `https://raw.githubusercontent.com/FAIRiCUBE/data-requests/main/stac_dist/${item.href.substr(2)}`
      mainItemsLinks.push(url)
})
}
const mainResults = await fetchList(mainItemsLinks)

const data = BranchData.concat(mainResults)




const filteredProduct = computed( () => {
            let filter = filterText.value
            if (!filter.length) return data
            return data.filter( item =>
                item.id.toLowerCase().includes(filter.toLowerCase())
            )
        })

const stacToForm = (stac) => {
  let formProduct = {
  "providers": [],
  "general": {},
  "horizontal_axis": {
    "bbox": [
      null,
      null,
      null,
      null
    ],
    "vertical_min_max": [
      null,
      null
    ],
    "time_begin_end": [
      "2020-03-13T18:22",
      "2020-03-13T18:22"
    ]
  },
  "other_dims": [],
  "bands": [],
  "legal": {},
  "use_case_S$E": [],
  "use_case_WER": [],
  "use_case_NHM": [],
  "use_case_NILU": [],
  "platform": []
}
stac.properties.providers.map( provider =>  {
  let providerObject = {
    organization_name:provider.name,
    organization: provider.name,
    comments: provider.description,
    doc_link: provider.url

  }
  formProduct.providers.push(providerObject);
})
formProduct.identifier = stac.id;
formProduct.title = stac.properties.title
formProduct.source_type = stac.properties.datasource_type;
formProduct.description = stac.properties.description;
formProduct.legal.keywords = stac.properties.keywords;


return formProduct
}

/// I need to set the initial values to be edited from the server
let product = ref({})

const showList = ref(true);
const showForm = ref(false);
const editForm= (item) => {

  product = stacToForm(item);
  showForm.value = true;
  showList.value =false;
}
const createForm = () => {
  product = ref({})
  showForm.value = true;
  showList.value =false;
}
const backToList = () => {
  product = ref({});
  filterText.value = "";
  showForm.value = false;
  showList.value =true;
}
let licensesData = [{label:"Other", value:"other"}]
const createLicenses = licenses.licenses.map(license => {
  licensesData.push({label: license.name, value: license.licenseId})
})
async function submit(values) {
  await new Promise(r => setTimeout(r, 1000))
  console.log(values)
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
    >
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
              label="Add"
              style="background-color:green"
              @click="createForm"
            />
        </div>
      <LazyList
        :data="filteredProduct"
        :itemsPerRender="150"
        containerClasses="list"
        defaultLoadingColor="#222"
      >
        <template v-slot="{item}">
          <div class="bbox" style="align-items: baseline; flex-direction: row-reverse;">
            <p class="title" style="min-width: fit-content;">{{ item.properties.title || item.id}}</p>
            <FormKit
              type="button"
              label="Edit"
              suffix-icon="settings"
              style="background-color:gray"
              help=""
              @click="editForm(item)"
            />
          </div>
        </template>
      </LazyList>
    </div>
    <FormKit
      type="form"
      id="registration"
      v-model="product"
      #default="{ value }"
      @submit="submit"
      v-show="showForm"
    >
    <FormKit
        type="button"
        label="back"
        @click="backToList"
      />

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
        type="url"
        label="Source"
        name="link"
        placeholder="https://www.example.com..."
        validation="required|url"
        help="The link to the source of the dataset."
      />
      <FormKit
        type="text"
        name="source_type"
        label="Source Type"
        help="The data source type"
      />
      <FormKit type="list"  dynamic #default="{ items, node, value }"
        name="providers">
        <h2 class ="title">Organizations</h2>
      <FormKit type="group"
        v-for="(item, index) in items"
        :key="item"
        :index="index"
      >
        <div class="group" >

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
      <FormKit
        type="textarea"
        name="comments"
        label="Comments"
      />
      <FormKit
        type="button"
        label="Remove"
        style="background-color:red"
        help="remove band"
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
    <FormKit
        type="group"
        name="general"
      >
      <h2 class ="title">General</h2>
      <FormKit
        type="text"
        name="area_cove"
        label="total area cover"
      />
    </FormKit>
    <FormKit
      type="group"
      name="horizontal_axis"
    >
      <h2 class ="title">Horizontal Axis</h2>
      <FormKit
        type="text"
        name="horizontal_crs"
        label="Horizontal CRS"
        placeholder="epsg:4326"
      />
      <FormKit
        type="list"
        name="bbox"
      >
      <div class="bbox">
        <h4 class ="title" style="padding: 0.5em;">BBOX</h4>
        <br>
        <FormKit
          type="text"
          label="bottom left long"
          number
          validation=""
          placeholder="-90.0"
          help="lower left corner longitude"
        />
        <FormKit
          type="text"
          label="bottom left lat"
          number
          validation=""
          placeholder="-180.0"
          help="lower left corner latitude"
        />
        <FormKit
          type="text"
          label="top right long"
          number
          validation=""
          placeholder="90.0"
          help="top right corner longitude"
        />
        <FormKit
          type="text"
          label="top right lat"
          number
          validation=""
          placeholder="180.0"
          help="top right corner latitude"
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
        name="Interpolation_Aggregation"
        label="Interpolation/Aggregation"
      />
      <FormKit
        type="text"
        name="resolution"
        label="Resolution"
        help="Resolution (or 'irregular'). Should be 1 value as required by UC, not all resolutions of dataset"
      />
    </FormKit>
    <FormKit
      type="group"
      name="horizontal_axis"
    >
      <h2 class ="title">Vertical Axis</h2>
      <FormKit
        type="text"
        name="vertical_crs"
        label="Vertical CRS"
        placeholder="epsg:4326"
      />
      <FormKit
        type="list"
        name="vertical_min_max"
      >
      <div class="bbox">
        <h4 class ="title" style="padding: 0.5em;">Lower/Upper Bound</h4>
        <br>
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
        name="Interpolation_Aggregation"
        label="Interpolation/Aggregation"
      />
      <FormKit
        type="text"
        name="resolution"
        label="Resolution"
        help="Resolution (or 'irregular'). Should be 1 value as required by UC, not all resolutions of dataset"
      />
    </FormKit>
    <FormKit
      type="group"
      name="horizontal_axis"
    >

      <h2 class ="title">Time Axis</h2>
      <FormKit
        type="list"
        name="time_begin_end"
      >
      <div class="bbox">
        <h4 class ="title" style="padding: 0.5em; padding-top: 0.5em;">Lower/Upper Bound</h4>
        <br>
        <FormKit
          type="datetime-local"
          label="begin time"
          validation=""
        />
        <FormKit
          type="datetime-local"
          label="end time"
          validation=""
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
        name="Interpolation_Aggregation"
        label="Interpolation/Aggregation"
      />
      <FormKit
        type="text"
        name="resolution"
        label="Resolution"
        help="Resolution (or 'irregular'). Should be 1 value as required by UC, not all resolutions of dataset"
      />

    </FormKit>
      <FormKit type="list"  dynamic #default="{ items, node, value }"
        name="other_dims">
        <h2 class ="title">Other Axis</h2>
      <FormKit type="group"
        v-for="(item, index) in items"
        :key="item"
        :index="index"
      >
        <div class="group">
          <FormKit
        type="text"
        name="crs"
        label="CRS"
        placeholder="epsg:4326"
      />
      <FormKit
        type="list"
        name="vertical_min_max"
      >
      <div class="bbox">
        <h4 class ="title" style="padding: 0.5em;">Lower/Upper Bound</h4>
        <br>
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
        name="Interpolation_Aggregation"
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
        style="background-color:red"
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
    <FormKit type="list"  dynamic #default="{ items, node, value }"
        name="bands">
        <h2 class ="title">Bands</h2>
      <FormKit type="group"
        v-for="(item, index) in items"
        :key="item"
        :index="index"
      >
        <div class="group"
          style="display: flex;flex-wrap: wrap;"
        >
      <FormKit
        type="text"
        name="band_name"
        label="cell components"
      />
      <FormKit
        type="text"
        name="unit"
        label="Unit of Measure"
      />
      <FormKit
      label="Data Type"
      type="select"
      placeholder="Select a data type"
      :options="dataTypes"
    />
      <FormKit
        type="text"
        number
        name="nodata"
        label="Null values"
      />
      <FormKit
        type="text"
        name="definition"
        label="Definition"
      />
      <FormKit
        type="text"
        name="description"
        label="Description"
      />
      <FormKit
        type="text"
        name="category_list"
        label="Category List"
      />
      <FormKit
        type="text"
        name="comment"
        label="Comment"
      />

      <FormKit
        type="button"
        label="Remove"
        style="background-color:red"
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
    <FormKit
      type="group"
      name="horizontal_axis"
    >

      <h2 class ="title">Re-projection axis </h2>
      <FormKit
        type="text"
        name="horizontal_crs"
        label="Horizontal CRS"
        placeholder="epsg:4326"
      />
      <FormKit
        type="text"
        name="unit_of_measure"
        label="Unit of Measure"
      />
      <FormKit
        type="text"
        name="resolution"
        label="Resolution"
      />
  </FormKit>
    <FormKit
      type="group"
      name="legal"
    >

      <h2 class ="title">Legal</h2>
    <FormKit
      label="License"
      type="select"
      placeholder="Select a license"
      name="license"
      :options="licensesData"
    />
    <FormKit
        type="text"
        name="personalData"
        label="Personal Data"
      />
      <FormKit
        type="text"
        name="Provenance_name"
        label="Provenance name"
      />
      <FormKit
        type="text"
        name="keywords"
        label="Keywords"
      />
      <FormKit
          type="datetime-local"
          label="begin time"
          name="date"
        />
  </FormKit>
  <FormKit
        type="checkbox"
        name="use_case_S$E"
        label="Priority (Climate change (S4E))"
        :options="{
          'one': 'One',
          'two': 'Two'
        }"
    />
    <FormKit
        type="checkbox"
        name="use_case_WER"
        label="Biodiversity & agri (WER)"
        :options="{
          'one': 'One',
          'two': 'Two'
        }"
    />
    <FormKit
        type="checkbox"
        name="use_case_NHM"
        label="Biodiversity occurrence cubes (NHM)"
        :options="{
          'one': 'One',
          'two': 'Two'
        }"
    />
    <FormKit
        type="checkbox"
        name="use_case_NILU"
        label="Neighbourhood building stock (NILU)"
        :options="{
          'one': 'One',
          'two': 'Two'
        }"
    />
    <FormKit
      type="checkbox"
      name="platform"
      label="Target Platform"
      :options="{
        'eox': 'EOX',
        'rasdaman': 'rasdaman',
        'other':'Other'
      }"
      validation="required|min:1"
    />
    <FormKit
        type="text"
        name="ingestion_status"
        label="Ingestion Status (rasdaman)"
      />
      <FormKit
        type="url"
        label="Thumbnails"
        name="thumbnails"
        placeholder="https://www.example.com..."
        help="link to the dataset thumbnail."
      />

      <pre>{{ value }}</pre>

    </FormKit>
  </div>
</template>

<style scoped>
.github-issue-form{
  width: calc(100% - 2em);
  max-width: 1000px;
  box-sizing: border-box;
  padding: 2em;
  box-shadow: 0 0 2em rgba(0, 0, 0, .1);
  border-radius: .5em;
  margin: 4em auto;
}


.title{
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
}
.logo {
  width: 150px;
  height: auto;
  display: block;
  margin: 0 auto 2em auto;
}
pre {
  background-color: rgba(0, 100, 250, .1);
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
  left: calc(100% + .5em);
  color: red;
  font-size: .75em;
}
button {
  align-self: flex-start;
}
</style>
