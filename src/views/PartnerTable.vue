<script setup>
import { ref, computed, onMounted } from 'vue'

// 1. Importamos todas las "tablas" JSON
import partnersRaw from '../data/partners.json'
import institutionTypesRaw from '../data/institution_type.json'
import classificationsRaw from '../data/classifications.json'
import colabTypesRaw from '../data/colab_type.json'
import partnershipTypesRaw from '../data/partnership_type.json'

const STORAGE_KEY = 'fiu_frontera_partners'

// Estado reactivo con los datos (carga desde localStorage si existen cambios previos)
const partnersList = ref([])

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    partnersList.value = JSON.parse(saved)
  } else {
    partnersList.value = [...partnersRaw]
  }
})

// 2. Mapas para cruzar los IDs rápidamente
const instTypeMap = new Map(institutionTypesRaw.map(i => [i.institution_type_id, i.tipo]))
const classificationMap = new Map(classificationsRaw.map(c => [c.classification_id, c.name]))
const colabTypeMap = new Map(colabTypesRaw.map(c => [c.colab_type_id, c.name]))
const partnershipMap = new Map(partnershipTypesRaw.map(p => [p.partnership_id, p.name]))

// 3. JOIN enriqueciendo cada partner con los nombres legibles
const enrichedPartners = computed(() => {
  return partnersList.value.map(partner => ({
    ...partner,
    institution_type_name: instTypeMap.get(partner.institution_type_id) || 'Desconocido',
    classification_name: classificationMap.get(partner.classification_id) || 'Sin clasificación',
    colab_type_name: colabTypeMap.get(partner.colab_type_id) || 'No definido',
    partnership_name: partnershipMap.get(partner.partnership_type) || 'Otro'
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

// Formateador de moneda CLP
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(amount || 0)
}

// 4. Estados reactivos para los filtros
const searchQuery = ref('')
const selectedInstType = ref('')
const selectedClassification = ref('')
const selectedColabType = ref('')
const selectedPartnership = ref('')
const onlyValidAgreement = ref(false)

// 5. Lógica de filtrado
const filteredPartners = computed(() => {
  return enrichedPartners.value.filter(p => {
    const matchesSearch =
      p.institution_name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      p.contact_name.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesInstType = !selectedInstType.value || p.institution_type_id === Number(selectedInstType.value)
    const matchesClassification = !selectedClassification.value || p.classification_id === Number(selectedClassification.value)
    const matchesColabType = !selectedColabType.value || p.colab_type_id === Number(selectedColabType.value)
    const matchesPartnership = !selectedPartnership.value || p.partnership_type === Number(selectedPartnership.value)
    const matchesValid = !onlyValidAgreement.value || p.valid_agreement === true

    return (
      matchesSearch &&
      matchesInstType &&
      matchesClassification &&
      matchesColabType &&
      matchesPartnership &&
      matchesValid
    )
  })
})

const resetFilters = () => {
  searchQuery.value = ''
  selectedInstType.value = ''
  selectedClassification.value = ''
  selectedColabType.value = ''
  selectedPartnership.value = ''
  onlyValidAgreement.value = false
}

// ==========================================
// 6. LÓGICA DEL MODAL PARA AGREGAR REGISTRO
// ==========================================
const isModalOpen = ref(false)

const getInitialForm = () => ({
  institution_name: '',
  contact_name: '',
  position: '',
  email: '',
  phone: '',
  framework_agreement: true,
  agreement_details: '',
  colaboration_total: 0,
  valid_agreement: true,
  institution_type_id: institutionTypesRaw[0]?.institution_type_id || 1,
  classification_id: uniqueClassifications.value[0]?.classification_id || 1,
  colab_type_id: colabTypesRaw[0]?.colab_type_id || 1,
  partnership_type: partnershipTypesRaw[0]?.partnership_id || 1
})

const newPartnerForm = ref(getInitialForm())

const openModal = () => {
  newPartnerForm.value = getInitialForm()
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const saveNewPartner = () => {
  const newRecord = {
    id: `inst-${Date.now()}`,
    ...newPartnerForm.value,
    colaboration_total: Number(newPartnerForm.value.colaboration_total) || 0,
    institution_type_id: Number(newPartnerForm.value.institution_type_id),
    classification_id: Number(newPartnerForm.value.classification_id),
    colab_type_id: Number(newPartnerForm.value.colab_type_id),
    partnership_type: Number(newPartnerForm.value.partnership_type)
  }

  partnersList.value.unshift(newRecord)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(partnersList.value))

  closeModal()
}

// ==========================================
// 7. LÓGICA PARA ELIMINAR REGISTRO
// ==========================================
const deletePartner = (partner) => {
  const confirmed = window.confirm(
    `¿Estás seguro de que deseas eliminar a "${partner.institution_name}"?`
  )
  if (!confirmed) return

  partnersList.value = partnersList.value.filter(p => p.id !== partner.id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(partnersList.value))
}

// Función opcional para descargar el JSON actualizado
const exportJson = () => {
  const dataStr = JSON.stringify(partnersList.value, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'partners.json'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="w-full px-6 py-6 font-sans text-slate-800">
    <!-- Encabezado -->
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Directorio de Partners</h2>
        <p class="text-sm text-slate-500 mt-1">
          Mostrando <span class="font-semibold text-slate-700">{{ filteredPartners.length }}</span> de
          <span class="font-semibold text-slate-700">{{ enrichedPartners.length }}</span> instituciones
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <button
          @click="resetFilters"
          class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Limpiar filtros
        </button>

        <button
          @click="exportJson"
          title="Descargar archivo partners.json actualizado"
          class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Exportar JSON
        </button>

        <button
          @click="openModal"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo Partner
        </button>
      </div>
    </header>

    <!-- Panel de Filtros -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 bg-white p-5 rounded-xl border border-slate-200 mb-6">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Buscar</label>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Institución o contacto..."
          class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

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

      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Tipo</label>
        <select
          v-model="selectedInstType"
          class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
        >
          <option value="">Pública y Privada</option>
          <option v-for="t in institutionTypesRaw" :key="t.institution_type_id" :value="t.institution_type_id">
            {{ t.tipo }}
          </option>
        </select>
      </div>

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

      <div class="flex items-end pb-2">
        <label class="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            v-model="onlyValidAgreement"
            class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
          />
          Solo vigentes
        </label>
      </div>
    </section>

    <!-- Tabla de Resultados -->
    <div class="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-xs">
      <table class="w-full text-left border-collapse text-sm">
        <thead>
          <tr class="bg-slate-100/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <th class="py-3.5 px-4">Institución</th>
            <th class="py-3.5 px-4">Clasificación</th>
            <th class="py-3.5 px-4">Tipo</th>
            <th class="py-3.5 px-4">Alcance</th>
            <th class="py-3.5 px-4">Alianza Principal</th>
            <th class="py-3.5 px-4">Contacto</th>
            <th class="py-3.5 px-4 text-right">Monto</th>
            <th class="py-3.5 px-4">Convenio</th>
            <th class="py-3.5 px-4 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr
            v-for="partner in filteredPartners"
            :key="partner.id"
            class="hover:bg-slate-50/90 transition-colors"
          >
            <td class="py-3.5 px-4 align-top">
              <div class="font-semibold text-slate-900">{{ partner.institution_name }}</div>
              <p v-if="partner.agreement_details" class="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                {{ partner.agreement_details }}
              </p>
            </td>

            <td class="py-3.5 px-4 align-top">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {{ partner.classification_name }}
              </span>
            </td>

            <td class="py-3.5 px-4 align-top capitalize text-slate-700">
              {{ partner.institution_type_name }}
            </td>

            <td class="py-3.5 px-4 align-top text-slate-700">
              {{ partner.colab_type_name }}
            </td>

            <td class="py-3.5 px-4 align-top">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300/70">
                {{ partner.partnership_name }}
              </span>
            </td>

            <td class="py-3.5 px-4 align-top">
              <div class="font-medium text-slate-800">{{ partner.contact_name }}</div>
              <div class="text-xs text-slate-500 mt-0.5">{{ partner.position }}</div>
              <div class="text-xs text-indigo-600 mt-0.5">{{ partner.email }}</div>
            </td>

            <td class="py-3.5 px-4 align-top text-right font-semibold text-slate-900 whitespace-nowrap">
              {{ formatCurrency(partner.colaboration_total) }}
            </td>

            <td class="py-3.5 px-4 align-top">
              <span
                :class="[
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold',
                  partner.valid_agreement
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                ]"
              >
                {{ partner.valid_agreement ? 'Vigente' : 'Inactivo / Vencido' }}
              </span>
            </td>

            <td class="py-3.5 px-4 align-top text-center">
              <button
                @click="deletePartner(partner)"
                type="button"
                title="Eliminar registro"
                aria-label="Eliminar registro"
                class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                  />
                </svg>
              </button>
            </td>
          </tr>

          <tr v-if="filteredPartners.length === 0">
            <td colspan="9" class="py-12 px-4 text-center text-slate-500">
              No se encontraron instituciones con los filtros seleccionados.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ========================================== -->
    <!-- MODAL PARA AGREGAR NUEVO PARTNER           -->
    <!-- ========================================== -->
    <div
      v-if="isModalOpen"
      @click.self="closeModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div class="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8">
        <!-- Cabecera Modal -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Registrar Nuevo Partner</h3>
            <p class="text-xs text-slate-500 mt-0.5">Completa los datos de la institución y su tipo de vinculación</p>
          </div>
          <button
            @click="closeModal"
            type="button"
            class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Formulario -->
        <form @submit.prevent="saveNewPartner" class="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <!-- Sección Institución -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Nombre de la Institución *</label>
              <input
                v-model="newPartnerForm.institution_name"
                type="text"
                required
                placeholder="Ej: Hospital Regional..."
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Clasificación</label>
              <select
                v-model="newPartnerForm.classification_id"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="c in uniqueClassifications" :key="c.classification_id" :value="c.classification_id">
                  {{ c.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Tipo de Alianza</label>
              <select
                v-model="newPartnerForm.partnership_type"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="p in partnershipTypesRaw" :key="p.partnership_id" :value="p.partnership_id">
                  {{ p.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Tipo de Institución</label>
              <select
                v-model="newPartnerForm.institution_type_id"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg capitalize focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="t in institutionTypesRaw" :key="t.institution_type_id" :value="t.institution_type_id">
                  {{ t.tipo }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Alcance</label>
              <select
                v-model="newPartnerForm.colab_type_id"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="ct in colabTypesRaw" :key="ct.colab_type_id" :value="ct.colab_type_id">
                  {{ ct.name }}
                </option>
              </select>
            </div>
          </div>

          <hr class="border-slate-200" />

          <!-- Sección Contacto -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Nombre Contacto *</label>
              <input
                v-model="newPartnerForm.contact_name"
                type="text"
                required
                placeholder="Ej: Ana María Pérez"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Cargo</label>
              <input
                v-model="newPartnerForm.position"
                type="text"
                placeholder="Ej: Directora de Innovación"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Correo Electrónico *</label>
              <input
                v-model="newPartnerForm.email"
                type="email"
                required
                placeholder="contacto@institucion.cl"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Teléfono</label>
              <input
                v-model="newPartnerForm.phone"
                type="text"
                placeholder="+56912345678"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <hr class="border-slate-200" />

          <!-- Sección Financiera y Convenio -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Monto Colaboración (CLP)</label>
              <input
                v-model.number="newPartnerForm.colaboration_total"
                type="number"
                min="0"
                step="100000"
                placeholder="0"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div class="flex flex-col justify-center gap-2 pt-2">
              <label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  v-model="newPartnerForm.framework_agreement"
                  type="checkbox"
                  class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                Tiene Convenio Marco
              </label>

              <label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  v-model="newPartnerForm.valid_agreement"
                  type="checkbox"
                  class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                Convenio Vigente
              </label>
            </div>

            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Detalles del Acuerdo / Observaciones</label>
              <textarea
                v-model="newPartnerForm.agreement_details"
                rows="2"
                placeholder="Breve descripción del alcance de la colaboración..."
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              ></textarea>
            </div>
          </div>

          <!-- Botones de acción -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Guardar Partner
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>