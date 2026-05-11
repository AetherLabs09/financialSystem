<template>
  <div>
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true">
        <el-form-item label="年份">
          <el-select v-model="searchYear" @change="loadData">
            <el-option v-for="y in years" :key="y" :label="y + '年'" :value="y" />
          </el-select>
        </el-form-item>
        <el-form-item label="月份">
          <el-select v-model="searchMonth" @change="loadData">
            <el-option v-for="m in 12" :key="m" :label="m + '月'" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleAdd">新增预算</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="tableData" stripe>
        <el-table-column prop="category_name" label="类目" width="200" />
        <el-table-column prop="amount" label="预算金额" width="150">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="used_amount" label="已使用" width="150">
          <template #default="{ row }">{{ formatMoney(row.used_amount) }}</template>
        </el-table-column>
        <el-table-column label="剩余" width="150">
          <template #default="{ row }">
            <span :class="row.amount - row.used_amount < 0 ? 'expense' : ''">
              {{ formatMoney(row.amount - row.used_amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="使用率" width="200">
          <template #default="{ row }">
            <el-progress 
              :percentage="Math.min(100, Math.round((row.used_amount / row.amount) * 100))" 
              :status="row.used_amount >= row.amount ? 'exception' : row.used_amount / row.amount >= 0.8 ? 'warning' : ''"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑预算' : '新增预算'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="类目" prop="categoryId">
          <el-select v-model="form.categoryId" placeholder="请选择" :disabled="isEdit">
            <el-option v-for="c in expenseCategories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="年份" prop="year">
          <el-select v-model="form.year" :disabled="isEdit">
            <el-option v-for="y in years" :key="y" :label="y + '年'" :value="y" />
          </el-select>
        </el-form-item>
        <el-form-item label="月份" prop="month">
          <el-select v-model="form.month" :disabled="isEdit">
            <el-option v-for="m in 12" :key="m" :label="m + '月'" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="预算金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getBudgets, createBudget, updateBudget, deleteBudget } from '../api/budgets'
import { getCategories } from '../api/categories'

const searchYear = ref(new Date().getFullYear())
const searchMonth = ref(new Date().getMonth() + 1)
const tableData = ref([])
const categories = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()

const currentYear = new Date().getFullYear()
const years = computed(() => [currentYear - 1, currentYear, currentYear + 1])

const expenseCategories = computed(() => categories.value.filter(c => c.type === 'expense' && c.status === 1))

const form = reactive({
  id: null,
  categoryId: '',
  year: currentYear,
  month: searchMonth.value,
  amount: 0
})

const rules = {
  categoryId: [{ required: true, message: '请选择类目', trigger: 'change' }],
  year: [{ required: true, message: '请选择年份', trigger: 'change' }],
  month: [{ required: true, message: '请选择月份', trigger: 'change' }],
  amount: [{ required: true, message: '请输入预算金额', trigger: 'blur' }]
}

const formatMoney = (value) => '¥' + (value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const loadData = async () => {
  tableData.value = await getBudgets({ year: searchYear.value, month: searchMonth.value })
}

const loadCategories = async () => {
  categories.value = await getCategories({})
}

const handleAdd = () => {
  isEdit.value = false
  form.id = null
  form.categoryId = ''
  form.year = searchYear.value
  form.month = searchMonth.value
  form.amount = 0
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  form.id = row.id
  form.categoryId = row.category_id
  form.year = row.year
  form.month = row.month
  form.amount = row.amount
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确定要删除该预算吗？', '提示', { type: 'warning' })
  await deleteBudget(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const submitForm = async () => {
  await formRef.value.validate()
  const data = {
    categoryId: form.categoryId,
    year: form.year,
    month: form.month,
    amount: form.amount
  }
  if (isEdit.value) {
    await updateBudget(form.id, data)
    ElMessage.success('更新成功')
  } else {
    await createBudget(data)
    ElMessage.success('添加成功')
  }
  dialogVisible.value = false
  loadData()
}

onMounted(() => {
  loadData()
  loadCategories()
})
</script>
