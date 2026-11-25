<script setup>
import Navbar from '../src/components/Navbar.vue'
import Sidebar from '../src/components/Sidebar.vue'

const handleOpenSettings = () => {
  console.log('Abrir configuración')
}
</script>

<template>
  <div class="min-h-screen w-full bg-slate-50 flex flex-col">
    <!-- Barra superior fija -->
    <Navbar @open-settings="handleOpenSettings" />

    <!-- Contenedor inferior: Sidebar + Vista activa -->
    <div class="flex flex-1 w-full">
      <Sidebar />
      <main class="flex-1 overflow-x-hidden">
        <RouterView />
      </main>
    </div>
  </div>
</template>