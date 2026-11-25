<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import cytoscape from 'cytoscape'

// Importamos las tablas JSON
import partnersRaw from '../data/partners.json'
import relationsRaw from '../data/relaciones.json'
import institutionTypesRaw from '../data/institution_type.json'
import classificationsRaw from '../data/classifications.json'
import colabTypesRaw from '../data/colab_type.json'
import partnershipTypesRaw from '../data/partnership_type.json'

const STORAGE_KEY = 'fiu_frontera_partners'
const partnersList = ref([])

// Mapas para cruzar IDs
const instTypeMap = new Map(institutionTypesRaw.map(i => [i.institution_type_id, i.tipo]))
const classificationMap = new Map(classificationsRaw.map(c => [c.classification_id, c.name]))
const colabTypeMap = new Map(colabTypesRaw.map(c => [c.colab_type_id, c.name]))
const partnershipMap = new Map(partnershipTypesRaw.map(p => [p.partnership_id, p.name]))

// Paleta de colores por clasificación para diferenciar los nodos
const classificationColors = {
  1: '#0284c7', // Ecosistema de Salud (Sky)
  2: '#7c3aed', // Ecosistema de Innovación (Violet)
  3: '#2563eb', // Instituciones Públicas (Blue)
  4: '#0d9488', // Asociaciones Gremiales (Teal)
  5: '#e11d48', // Asociaciones de Pacientes (Rose)
  6: '#4f46e5', // Organismos Internacionales (Indigo)
  7: '#059669', // Empresas (Emerald)
  8: '#d97706', // Sin Fines de Lucro (Amber)
  9: '#9333ea', // Educación Superior (Purple)
  11: '#475569' // Experto (Slate)
}

// JOIN de datos
const enrichedPartners = computed(() => {
  return partnersList.value.map(partner => ({
    ...partner,
    institution_type_name: instTypeMap.get(partner.institution_type_id) || 'Desconocido',
    classification_name: classificationMap.get(partner.classification_id) || 'Sin clasificación',
    colab_type_name: colabTypeMap.get(partner.colab_type_id) || 'No definido',
    partnership_name: partnershipMap.get(partner.partnership_type) || 'Otro',
    color: classificationColors[partner.classification_id] || '#64748b'
  }))
})

const uniqueClassifications = computed(() => {
  const seen = new Set()
  return classificationsRaw.filter(item => {
    if (seen.has(item.name)) return false
    seen.add(item.name)
    return true
  })
})

// Estados de Filtros y Clustering
const selectedClassification = ref('')
const selectedPartnership = ref('')
const selectedColabType = ref('')
const onlyValidAgreement = ref(false)
const clusterBy = ref('classification_name') // 'none' | 'classification_name' | 'partnership_name' | 'colab_type_name' | 'institution_type_name'
const showEdgeLabels = ref(true)

// Nodo seleccionado al hacer clic
const selectedNode = ref(null)

// Partners filtrados
const filteredPartners = computed(() => {
  return enrichedPartners.value.filter(p => {
    const matchesClassification = !selectedClassification.value || p.classification_id === Number(selectedClassification.value)
    const matchesPartnership = !selectedPartnership.value || p.partnership_type === Number(selectedPartnership.value)
    const matchesColabType = !selectedColabType.value || p.colab_type_id === Number(selectedColabType.value)
    const matchesValid = !onlyValidAgreement.value || p.valid_agreement === true
    return matchesClassification && matchesPartnership && matchesColabType && matchesValid
  })
})

// Referencia al contenedor HTML y a la instancia de Cytoscape
const cyContainer = ref(null)
let cy = null

// Construcción de elementos (Nodos + Clusters + Aristas) para Cytoscape
const buildGraphElements = () => {
  const elements = []
  const visibleIds = new Set(['inst-0']) // Siempre mantenemos a FIU Frontera en el radar
  const clusterGroups = new Set()

  // 1. Nodo Central: Nuestra Institución
  elements.push({
    data: {
      id: 'inst-0',
      label: 'FIU FRONTERA',
      isCore: true,
      color: '#0f172a',
      size: 68
    }
  })

  // 2. Nodos de Partners filtrados y generación de Clusters
  filteredPartners.value.forEach(p => {
    visibleIds.add(p.id)
    let parentId = undefined

    if (clusterBy.value !== 'none') {
      const groupName = p[clusterBy.value]
      parentId = `cluster-${groupName}`

      if (!clusterGroups.has(parentId)) {
        clusterGroups.add(parentId)
        elements.push({
          data: {
            id: parentId,
            label: groupName.toUpperCase(),
            isCluster: true
          }
        })
      }
    }

    // Tamaño dinámico basado en el aporte financiero (mínimo 34px, máximo 60px)
    const dynamicSize = Math.min(60, Math.max(34, 34 + (p.colaboration_total / 2500000)))

    elements.push({
      data: {
        id: p.id,
        label: p.institution_name,
        parent: parentId,
        color: p.color,
        size: dynamicSize,
        raw: p
      }
    })
  })

  // 3. Aristas (Relaciones)
  // Primero usamos las relaciones explícitas de relaciones.json si ambos nodos están visibles
  const connectedToCore = new Set()

  relationsRaw.forEach((rel, idx) => {
    if (visibleIds.has(rel.source) && visibleIds.has(rel.target)) {
      if (rel.source === 'inst-0') connectedToCore.add(rel.target)
      if (rel.target === 'inst-0') connectedToCore.add(rel.source)

      elements.push({
        data: {
          id: `edge-${idx}`,
          source: rel.source,
          target: rel.target,
          label: rel.label,
          isDirectCore: rel.source === 'inst-0' || rel.target === 'inst-0'
        }
      })
    }
  })

  // Si un partner filtrado (o recién creado) no tiene enlace explícito en relaciones.json,
  // lo conectamos automáticamente a FIU Frontera usando su tipo de alianza
  filteredPartners.value.forEach(p => {
    if (!connectedToCore.has(p.id)) {
      elements.push({
        data: {
          id: `auto-edge-${p.id}`,
          source: 'inst-0',
          target: p.id,
          label: p.partnership_name,
          isDirectCore: true
        }
      })
    }
  })

  return elements
}

// Renderizar o actualizar el grafo
const renderGraph = () => {
  if (!cyContainer.value) return

  if (cy) {
    cy.destroy()
  }

  cy = cytoscape({
    container: cyContainer.value,
    elements: buildGraphElements(),
    style: [
      // Estilo de los Clusters (Cajas agrupadoras)
      {
        selector: 'node[?isCluster]',
        style: {
          'background-color': '#f1f5f9',
          'background-opacity': 0.75,
          'border-color': '#cbd5e1',
          'border-width': 1.5,
          'border-style': 'dashed',
          'label': 'data(label)',
          'text-valign': 'top',
          'text-halign': 'center',
          'text-margin-y': -8,
          'font-size': '10px',
          'font-weight': 'bold',
          'color': '#475569',
          'padding': '22px'
        }
      },
      // Estilo de los Nodos Partners
      {
        selector: 'node[!isCluster]',
        style: {
          'background-color': 'data(color)',
          'label': 'data(label)',
          'width': 'data(size)',
          'height': 'data(size)',
          'color': '#1e293b',
          'font-size': '11px',
          'font-weight': '600',
          'text-valign': 'bottom',
          'text-margin-y': 6,
          'text-wrap': 'wrap',
          'text-max-width': '110px',
          'border-width': 2.5,
          'border-color': '#ffffff'
        }
      },
      // Estilo especial Nodo Central (FIU Frontera)
      {
        selector: 'node[?isCore]',
        style: {
          'background-color': '#0f172a',
          'border-width': 4,
          'border-color': '#6366f1',
          'font-size': '12px',
          'font-weight': '800',
          'color': '#0f172a'
        }
      },
      // Nodo seleccionado
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#f59e0b'
        }
      },
      // Estilo de las Líneas / Relaciones
      {
        selector: 'edge',
        style: {
          'width': 1.8,
          'line-color': '#cbd5e1',
          'target-arrow-color': '#94a3b8',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': showEdgeLabels.value ? 'data(label)' : '',
          'font-size': '9px',
          'color': '#64748b',
          'text-rotation': 'autorotate',
          'text-background-color': '#ffffff',
          'text-background-opacity': 0.85,
          'text-background-padding': '2px'
        }
      },
      // Líneas conectadas directamente a FIU Frontera
      {
        selector: 'edge[?isDirectCore]',
        style: {
          'line-color': '#a5b4fc',
          'target-arrow-color': '#6366f1',
          'width': 2.2
        }
      }
    ],
    layout: {
      name: 'cose',
      animate: true,
      animationDuration: 500,
      nodeRepulsion: 8500,
      idealEdgeLength: 110,
      nestingFactor: 1.2,
      padding: 35
    }
  })

  // Evento al hacer clic en un nodo
  cy.on('tap', 'node[!isCluster]', (evt) => {
    const nodeData = evt.target.data()
    if (nodeData.isCore) {
      selectedNode.value = {
        institution_name: 'FIU FRONTERA',
        classification_name: 'Nodo Central',
        agreement_details: 'Institución articuladora de la red de innovación y vinculación.',
        isCore: true
      }
    } else {
      selectedNode.value = nodeData.raw
    }
  })

  // Cerrar panel al hacer clic en el fondo vacío
  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      selectedNode.value = null
    }
  })
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(amount || 0)
}

const resetView = () => {
  if (cy) {
    cy.fit(null, 35)
  }
}

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  partnersList.value = saved ? JSON.parse(saved) : [...partnersRaw]
  renderGraph()
})

// Re-renderizamos el grafo cada vez que cambian los filtros o el criterio de clustering
watch([filteredPartners, clusterBy, showEdgeLabels], () => {
  renderGraph()
})

onBeforeUnmount(() => {
  if (cy) cy.destroy()
})
</script>

<template>
  <div class="w-full px-6 py-6 font-sans text-slate-800 flex flex-col gap-5">
    <!-- Encabezado -->
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Partner Radar</h2>
        <p class="text-sm text-slate-500 mt-1">
          Visualizando <span class="font-semibold text-slate-700">{{ filteredPartners.length }}</span> nodos conectados a FIU Frontera
        </p>
      </div>

      <button
        @click="resetView"
        class="self-start sm:self-auto px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
      >
        Centrar Grafo
      </button>
    </header>

    <!-- Barra de Controles: Clustering + Filtros -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 bg-white p-4 rounded-xl border border-slate-200">
      <!-- Selector de Clustering (Destacado) -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-bold text-indigo-700 uppercase tracking-wider">Agrupar (Cluster) por</label>
        <select
          v-model="clusterBy"
          class="w-full px-3 py-2 text-sm font-medium bg-indigo-50/70 text-indigo-950 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="classification_name">Clasificación</option>
          <option value="partnership_name">Tipo de Alianza</option>
          <option value="colab_type_name">Alcance (Nac/Int)</option>
          <option value="institution_type_name">Tipo (Pública/Privada)</option>
          <option value="none">Sin agrupar (Red libre)</option>
        </select>
      </div>

      <!-- Filtro Clasificación -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Clasificación</label>
        <select
          v-model="selectedClassification"
          class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todas</option>
          <option v-for="c in uniqueClassifications" :key="c.classification_id" :value="c.classification_id">
            {{ c.name }}
          </option>
        </select>
      </div>

      <!-- Filtro Alianza -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Alianza</label>
        <select
          v-model="selectedPartnership"
          class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todas</option>
          <option v-for="p in partnershipTypesRaw" :key="p.partnership_id" :value="p.partnership_id">
            {{ p.name }}
          </option>
        </select>
      </div>

      <!-- Filtro Alcance -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Alcance</label>
        <select
          v-model="selectedColabType"
          class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos</option>
          <option v-for="ct in colabTypesRaw" :key="ct.colab_type_id" :value="ct.colab_type_id">
            {{ ct.name }}
          </option>
        </select>
      </div>

      <!-- Checkboxes visuales -->
      <div class="flex flex-col justify-center gap-2 pt-1">
        <label class="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
          <input type="checkbox" v-model="onlyValidAgreement" class="w-4 h-4 text-indigo-600 rounded" />
          Solo convenios vigentes
        </label>
        <label class="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
          <input type="checkbox" v-model="showEdgeLabels" class="w-4 h-4 text-indigo-600 rounded" />
          Mostrar etiquetas en líneas
        </label>
      </div>

      <!-- Leyenda rápida -->
      <div class="flex flex-col justify-center text-xs text-slate-500 border-l border-slate-200 pl-3">
        <span>• Haz clic en un nodo para ver detalles.</span>
        <span>• Arrastra nodos o haz zoom con la rueda.</span>
      </div>
    </section>

    <!-- Contenedor Principal del Grafo + Panel Lateral de Detalles -->
    <div class="relative w-full h-[620px] bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex">
      <!-- Lienzo Cytoscape -->
      <div ref="cyContainer" class="w-full h-full"></div>

      <!-- Panel Flotante de Información del Nodo Seleccionado -->
      <aside
        v-if="selectedNode"
        class="absolute top-4 right-4 w-80 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl shadow-lg p-5 z-10"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
            {{ selectedNode.classification_name }}
          </span>
          <button
            @click="selectedNode = null"
            class="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <h3 class="text-base font-bold text-slate-900 mt-2">{{ selectedNode.institution_name }}</h3>
        <p v-if="selectedNode.agreement_details" class="text-xs text-slate-600 mt-1.5 leading-relaxed">
          {{ selectedNode.agreement_details }}
        </p>

        <div v-if="!selectedNode.isCore" class="mt-4 pt-3 border-t border-slate-200 space-y-2 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500">Alianza Principal:</span>
            <span class="font-semibold text-slate-800">{{ selectedNode.partnership_name }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Tipo / Alcance:</span>
            <span class="font-medium text-slate-800 capitalize">
              {{ selectedNode.institution_type_name }} · {{ selectedNode.colab_type_name }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Monto Colaboración:</span>
            <span class="font-bold text-slate-900">{{ formatCurrency(selectedNode.colaboration_total) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-slate-500">Estado Convenio:</span>
            <span
              :class="[
                'px-2 py-0.5 rounded font-semibold',
                selectedNode.valid_agreement ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              ]"
            >
              {{ selectedNode.valid_agreement ? 'Vigente' : 'Inactivo' }}
            </span>
          </div>

          <div class="pt-2 border-t border-slate-100">
            <p class="text-slate-400 uppercase font-semibold text-[10px]">Contacto</p>
            <p class="font-semibold text-slate-800 mt-0.5">{{ selectedNode.contact_name }}</p>
            <p class="text-slate-500">{{ selectedNode.position }}</p>
            <p class="text-indigo-600">{{ selectedNode.email }}</p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>