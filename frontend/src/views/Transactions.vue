<template>
  <div>
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="日期范围">
          <el-date-picker v-model="dateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" clearable placeholder="全部">
            <el-option label="收入" value="income" />
            <el-option label="支出" value="expense" />
          </el-select>
        </el-form-item>
        <el-form-item label="类目">
          <el-select v-model="searchForm.categoryId" clearable placeholder="全部">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="往来单位">
          <el-select v-model="searchForm.partnerId" clearable filterable placeholder="全部">
            <el-option v-for="p in partners" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button type="success" @click="handleAdd">新增</el-button>
          <el-button type="warning" @click="handleExport">导出</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="tableData" stripe>
        <el-table-column prop="serial_no" label="流水号" width="180" />
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.type === 'income' ? 'success' : 'danger'">
              {{ row.type === 'income' ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="类目" width="120" />
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">
            <span :class="row.type === 'income' ? 'income' : 'expense'">
              {{ formatMoney(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="partner_name" label="往来单位" width="150" />
        <el-table-column prop="handler" label="经手人" width="100" />
        <el-table-column prop="transaction_date" label="日期" width="120" />
        <el-table-column prop="remark" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadData"
        @current-change="loadData"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑收支' : '新增收支'" width="600px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="类型" prop="type">
              <el-radio-group v-model="form.type" @change="handleTypeChange">
                <el-radio value="income">收入</el-radio>
                <el-radio value="expense">支出</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="金额" prop="amount">
              <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="类目" prop="categoryId">
              <el-select v-model="form.categoryId" placeholder="请选择">
                <el-option v-for="c in filteredCategories" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="往来单位">
              <el-select v-model="form.partnerId" filterable clearable placeholder="请选择">
                <el-option v-for="p in partners" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="日期" prop="transactionDate">
              <el-date-picker v-model="form.transactionDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经手人">
              <el-input v-model="form.handler" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="凭证">
          <el-upload
            :action="uploadUrl"
            :headers="uploadHeaders"
            :on-success="handleUploadSuccess"
            :show-file-list="false"
          >
            <el-button type="primary">上传凭证</el-button>
          </el-upload>
          <div v-if="form.voucherPath" style="margin-top: 10px">
            <el-link :href="form.voucherPath" target="_blank">查看凭证</el-link>
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
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
import { getTransactions, createTransaction, updateTransaction, deleteTransaction, exportTransactions } from '../api/transactions'
import { getCategories } from '../api/categories'
import { getPartners } from '../api/partners'

const dateRange = ref([])
const searchForm = reactive({ type: '', categoryId: '', partnerId: '' })
const tableData = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const categories = ref([])
const partners = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()

const form = reactive({
  id: null,
  type: 'expense',
  amount: 0,
  categoryId: '',
  partnerId: '',
  transactionDate: '',
  handler: '',
  voucherPath: '',
  remark: ''
})

const rules = {
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择类目', trigger: 'change' }],
  transactionDate: [{ required: true, message: '请选择日期', trigger: 'change' }]
}

const uploadUrl = '/api/upload'
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))

const filteredCategories = computed(() => categories.value.filter(c => c.type === form.type && c.status === 1))

const formatMoney = (value) => '¥' + (value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const loadData = async () => {
  const params = {
    page: pagination.page,
    pageSize: pagination.pageSize,
    ...searchForm
  }
  if (dateRange.value?.length === 2) {
    params.startDate = dateRange.value[0]
    params.endDate = dateRange.value[1]
  }
  const res = await getTransactions(params)
  tableData.value = res.list
  pagination.total = res.total
}

const loadCategories = async () => {
  categories.value = await getCategories({})
}

const loadPartners = async () => {
  partners.value = await getPartners({})
}

const resetSearch = () => {
  dateRange.value = []
  searchForm.type = ''
  searchForm.categoryId = ''
  searchForm.partnerId = ''
  loadData()
}

const handleTypeChange = () => {
  form.categoryId = ''
}

const handleAdd = () => {
  isEdit.value = false
  form.id = null
  form.type = 'expense'
  form.amount = 0
  form.categoryId = ''
  form.partnerId = ''
  form.transactionDate = new Date().toISOString().slice(0, 10)
  form.handler = ''
  form.voucherPath = ''
  form.remark = ''
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  form.id = row.id
  form.type = row.type
  form.amount = row.amount
  form.categoryId = row.category_id
  form.partnerId = row.partner_id
  form.transactionDate = row.transaction_date
  form.handler = row.handler
  form.voucherPath = row.voucher_path
  form.remark = row.remark
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确定要删除该记录吗？', '提示', { type: 'warning' })
  await deleteTransaction(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const handleUploadSuccess = (res) => {
  form.voucherPath = res.path
  ElMessage.success('上传成功')
}

const handleExport = async () => {
  const params = { ...searchForm }
  if (dateRange.value?.length === 2) {
    params.startDate = dateRange.value[0]
    params.endDate = dateRange.value[1]
  }
  const res = await exportTransactions(params)
  const blob = new Blob([res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transactions_${Date.now()}.xlsx`
  a.click()
  window.URL.revokeObjectURL(url)
}

const submitForm = async () => {
  await formRef.value.validate()
  const data = {
    type: form.type,
    amount: form.amount,
    categoryId: form.categoryId,
    partnerId: form.partnerId || null,
    transactionDate: form.transactionDate,
    handler: form.handler,
    voucherPath: form.voucherPath,
    remark: form.remark
  }
  if (isEdit.value) {
    await updateTransaction(form.id, data)
    ElMessage.success('更新成功')
  } else {
    await createTransaction(data)
    ElMessage.success('添加成功')
  }
  dialogVisible.value = false
  loadData()
}

onMounted(() => {
  loadData()
  loadCategories()
  loadPartners()
})
</script>
