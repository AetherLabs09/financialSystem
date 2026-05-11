<template>
  <div>
    <el-card style="margin-bottom: 20px">
      <template #header>
        <span>基础设置</span>
      </template>
      <el-form :model="settingsForm" label-width="120px" style="max-width: 500px">
        <el-form-item label="货币类型">
          <el-select v-model="settingsForm.currency">
            <el-option label="人民币 (CNY)" value="CNY" />
            <el-option label="美元 (USD)" value="USD" />
            <el-option label="欧元 (EUR)" value="EUR" />
          </el-select>
        </el-form-item>
        <el-form-item label="货币符号">
          <el-input v-model="settingsForm.currency_symbol" style="width: 100px" />
        </el-form-item>
        <el-form-item label="流水号前缀">
          <el-input v-model="settingsForm.serial_prefix" style="width: 150px" />
        </el-form-item>
        <el-form-item label="预算预警阈值">
          <el-input-number v-model="settingsForm.budget_alert_threshold" :min="50" :max="100" />
          <span style="margin-left: 10px">%</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>财务年度</span>
          <el-button type="primary" @click="handleAddYear">新增年度</el-button>
        </div>
      </template>
      <el-table :data="years" stripe>
        <el-table-column prop="year" label="年度" width="150">
          <template #default="{ row }">{{ row.year }}年</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'open' ? 'success' : 'info'">
              {{ row.status === 'open' ? '开启' : '已结账' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="closed_at" label="结账时间" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="warning" link @click="handleCloseYear(row)" v-if="row.status === 'open'">结账</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card>
      <template #header>
        <span>数据管理</span>
      </template>
      <el-space>
        <el-button type="primary" @click="handleBackup">备份数据库</el-button>
      </el-space>
      <el-alert type="info" style="margin-top: 20px" :closable="false">
        <p>备份数据库将下载当前数据库文件，请妥善保管备份文件。</p>
      </el-alert>
    </el-card>

    <el-dialog v-model="yearDialogVisible" title="新增财务年度" width="400px">
      <el-form :model="yearForm" :rules="yearRules" ref="yearFormRef" label-width="80px">
        <el-form-item label="年度" prop="year">
          <el-date-picker v-model="yearForm.year" type="year" placeholder="选择年度" value-format="YYYY" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="yearDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitYear">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSettings, updateSettings, getFinancialYears, createFinancialYear, closeFinancialYear, backupDatabase } from '../api/settings'

const settingsForm = reactive({
  currency: 'CNY',
  currency_symbol: '¥',
  serial_prefix: 'FIN',
  budget_alert_threshold: 80
})

const years = ref([])
const yearDialogVisible = ref(false)
const yearFormRef = ref()

const yearForm = reactive({
  year: ''
})

const yearRules = {
  year: [{ required: true, message: '请选择年度', trigger: 'change' }]
}

const loadSettings = async () => {
  const res = await getSettings()
  Object.assign(settingsForm, res)
}

const loadYears = async () => {
  years.value = await getFinancialYears()
}

const saveSettings = async () => {
  await updateSettings(settingsForm)
  ElMessage.success('保存成功')
}

const handleAddYear = () => {
  yearForm.year = ''
  yearDialogVisible.value = true
}

const handleCloseYear = async (row) => {
  await ElMessageBox.confirm(`确定要结账 ${row.year} 年度吗？结账后将无法修改该年度数据。`, '提示', { type: 'warning' })
  await closeFinancialYear(row.id)
  ElMessage.success('结账成功')
  loadYears()
}

const submitYear = async () => {
  await yearFormRef.value.validate()
  await createFinancialYear({ year: parseInt(yearForm.year) })
  ElMessage.success('添加成功')
  yearDialogVisible.value = false
  loadYears()
}

const handleBackup = async () => {
  const res = await backupDatabase()
  const blob = new Blob([res], { type: 'application/octet-stream' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance_backup_${Date.now()}.db`
  a.click()
  window.URL.revokeObjectURL(url)
  ElMessage.success('备份成功')
}

onMounted(() => {
  loadSettings()
  loadYears()
})
</script>
