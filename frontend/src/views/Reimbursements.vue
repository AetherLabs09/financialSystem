<template>
  <div>
    <el-card style="margin-bottom: 20px">
      <el-form :inline="true">
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" clearable placeholder="全部" @change="loadData">
            <el-option label="待审批" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleAdd">提交报销</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="tableData" stripe>
        <el-table-column prop="serial_no" label="报销单号" width="180" />
        <el-table-column prop="applicant_name" label="申请人" width="100" />
        <el-table-column prop="category_name" label="类目" width="120" />
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="description" label="说明" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.type">{{ statusMap[row.status]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="payment_status" label="打款状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.payment_status === 'paid' ? 'success' : 'info'">
              {{ row.payment_status === 'paid' ? '已打款' : '未打款' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="提交时间" width="180" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleView(row)">查看</el-button>
            <el-button type="success" link @click="handleApprove(row)" v-if="row.status === 'pending' && canApprove">审批</el-button>
            <el-button type="warning" link @click="handlePay(row)" v-if="row.status === 'approved' && row.payment_status !== 'paid' && canPay">打款</el-button>
            <el-button type="danger" link @click="handleDelete(row)" v-if="row.status === 'pending' && row.applicant_id === currentUserId">删除</el-button>
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

    <el-dialog v-model="dialogVisible" title="提交报销" width="600px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="类目">
          <el-select v-model="form.categoryId" clearable placeholder="请选择">
            <el-option v-for="c in expenseCategories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="凭证">
          <el-upload
            :action="uploadUrl"
            :headers="uploadHeaders"
            :on-success="handleUploadSuccess"
            :file-list="fileList"
            multiple
          >
            <el-button type="primary">上传凭证</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="报销详情" width="600px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="报销单号">{{ detail.serial_no }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ detail.applicant_name }}</el-descriptions-item>
        <el-descriptions-item label="金额">{{ formatMoney(detail.amount) }}</el-descriptions-item>
        <el-descriptions-item label="类目">{{ detail.category_name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusMap[detail.status]?.type">{{ statusMap[detail.status]?.label }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="打款状态">
          <el-tag :type="detail.payment_status === 'paid' ? 'success' : 'info'">
            {{ detail.payment_status === 'paid' ? '已打款' : '未打款' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="说明" :span="2">{{ detail.description }}</el-descriptions-item>
        <el-descriptions-item label="拒绝原因" :span="2" v-if="detail.reject_reason">{{ detail.reject_reason }}</el-descriptions-item>
        <el-descriptions-item label="审批人">{{ detail.approver_name }}</el-descriptions-item>
        <el-descriptions-item label="审批时间">{{ detail.approved_at }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="approveDialogVisible" title="审批" width="400px">
      <el-form :model="approveForm" ref="approveFormRef" label-width="80px">
        <el-form-item label="审批结果">
          <el-radio-group v-model="approveForm.status">
            <el-radio value="approved">通过</el-radio>
            <el-radio value="rejected">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="拒绝原因" v-if="approveForm.status === 'rejected'" prop="rejectReason">
          <el-input v-model="approveForm.rejectReason" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitApprove">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getReimbursements, getReimbursement, createReimbursement, approveReimbursement, payReimbursement, deleteReimbursement } from '../api/reimbursements'
import { getCategories } from '../api/categories'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const currentUserId = computed(() => userStore.userInfo?.id)
const canApprove = computed(() => userStore.hasPermission('reimbursement:approve'))
const canPay = computed(() => userStore.hasPermission('reimbursement:pay'))

const searchForm = reactive({ status: '' })
const tableData = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const categories = ref([])
const dialogVisible = ref(false)
const detailVisible = ref(false)
const approveDialogVisible = ref(false)
const formRef = ref()
const approveFormRef = ref()
const detail = ref({})
const fileList = ref([])

const statusMap = {
  pending: { label: '待审批', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已拒绝', type: 'danger' }
}

const form = reactive({
  amount: 0,
  categoryId: '',
  description: ''
})

const approveForm = reactive({
  status: 'approved',
  rejectReason: ''
})

const rules = {
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  description: [{ required: true, message: '请输入说明', trigger: 'blur' }]
}

const expenseCategories = computed(() => categories.value.filter(c => c.type === 'expense' && c.status === 1))
const uploadUrl = '/api/upload'
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))

const formatMoney = (value) => '¥' + (value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const loadData = async () => {
  const res = await getReimbursements({ ...searchForm, page: pagination.page, pageSize: pagination.pageSize })
  tableData.value = res.list
  pagination.total = res.total
}

const loadCategories = async () => {
  categories.value = await getCategories({})
}

const handleAdd = () => {
  form.amount = 0
  form.categoryId = ''
  form.description = ''
  fileList.value = []
  dialogVisible.value = true
}

const handleView = async (row) => {
  detail.value = await getReimbursement(row.id)
  detailVisible.value = true
}

const handleApprove = (row) => {
  detail.value = row
  approveForm.status = 'approved'
  approveForm.rejectReason = ''
  approveDialogVisible.value = true
}

const handlePay = async (row) => {
  await ElMessageBox.confirm('确定已打款吗？', '提示', { type: 'warning' })
  await payReimbursement(row.id)
  ElMessage.success('打款成功')
  loadData()
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确定要删除该报销单吗？', '提示', { type: 'warning' })
  await deleteReimbursement(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const handleUploadSuccess = (res) => {
  fileList.value.push({ name: res.filename, path: res.path })
}

const submitForm = async () => {
  await formRef.value.validate()
  await createReimbursement({
    amount: form.amount,
    categoryId: form.categoryId,
    description: form.description,
    voucherPaths: JSON.stringify(fileList.value.map(f => f.path))
  })
  ElMessage.success('提交成功')
  dialogVisible.value = false
  loadData()
}

const submitApprove = async () => {
  if (approveForm.status === 'rejected' && !approveForm.rejectReason) {
    return ElMessage.warning('请输入拒绝原因')
  }
  await approveReimbursement(detail.value.id, {
    status: approveForm.status,
    rejectReason: approveForm.rejectReason
  })
  ElMessage.success('审批完成')
  approveDialogVisible.value = false
  loadData()
}

onMounted(() => {
  loadData()
  loadCategories()
})
</script>
