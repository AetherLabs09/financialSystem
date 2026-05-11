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
          <el-select v-model="searchMonth" @change="loadData" clearable>
            <el-option label="全部" :value="null" />
            <el-option v-for="m in 12" :key="m" :label="m + '月'" :value="m" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="label">收入</div>
          <div class="value income">{{ formatMoney(summary.income) }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="label">支出</div>
          <div class="value expense">{{ formatMoney(summary.expense) }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="label">利润</div>
          <div class="value profit">{{ formatMoney(summary.profit) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>收支趋势</span>
          </template>
          <div ref="trendChartRef" style="height: 350px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>收入类目占比</span>
          </template>
          <div ref="incomePieRef" style="height: 350px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>支出类目占比</span>
          </template>
          <div ref="expensePieRef" style="height: 350px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>往来单位统计</span>
          </template>
          <el-table :data="partnerData" max-height="350">
            <el-table-column prop="name" label="单位名称" />
            <el-table-column prop="type" label="类型" width="80">
              <template #default="{ row }">
                {{ row.type === 'customer' ? '客户' : row.type === 'supplier' ? '供应商' : '其他' }}
              </template>
            </el-table-column>
            <el-table-column label="收入" width="120">
              <template #default="{ row }">{{ formatMoney(row.income) }}</template>
            </el-table-column>
            <el-table-column label="支出" width="120">
              <template #default="{ row }">{{ formatMoney(row.expense) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { getReportSummary, getReportMonthly, getReportByCategory, getReportByPartner } from '../api/reports'

const searchYear = ref(new Date().getFullYear())
const searchMonth = ref(null)
const summary = ref({ income: 0, expense: 0, profit: 0 })
const monthlyData = ref([])
const categoryData = ref([])
const partnerData = ref([])

const trendChartRef = ref()
const incomePieRef = ref()
const expensePieRef = ref()

const currentYear = new Date().getFullYear()
const years = computed(() => [currentYear - 2, currentYear - 1, currentYear])

const formatMoney = (value) => '¥' + (value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const initTrendChart = () => {
  const chart = echarts.init(trendChartRef.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出'] },
    xAxis: { type: 'category', data: monthlyData.value.map(d => d.month + '月') },
    yAxis: { type: 'value' },
    series: [
      { name: '收入', type: 'bar', data: monthlyData.value.map(d => d.income), itemStyle: { color: '#67c23a' } },
      { name: '支出', type: 'bar', data: monthlyData.value.map(d => d.expense), itemStyle: { color: '#f56c6c' } }
    ]
  })
}

const initPieChart = (ref, data, type) => {
  const chart = echarts.init(ref.value)
  const filteredData = data.filter(d => d.type === type && d.total > 0)
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: filteredData.map(d => ({ name: d.name, value: d.total })),
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
    }]
  })
}

const loadData = async () => {
  const params = { year: searchYear.value }
  if (searchMonth.value) {
    params.month = searchMonth.value
  }

  const [summaryRes, monthlyRes, categoryRes, partnerRes] = await Promise.all([
    getReportSummary(params),
    getReportMonthly({ year: searchYear.value }),
    getReportByCategory(params),
    getReportByPartner(params)
  ])

  summary.value = summaryRes
  monthlyData.value = monthlyRes
  categoryData.value = categoryRes
  partnerData.value = partnerRes

  await nextTick()
  initTrendChart()
  initPieChart(incomePieRef, categoryData.value, 'income')
  initPieChart(expensePieRef, categoryData.value, 'expense')
}

onMounted(() => {
  loadData()
})

watch([searchYear, searchMonth], () => {
  loadData()
})
</script>
