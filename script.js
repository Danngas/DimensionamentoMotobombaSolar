async function carregarBombas() {
  try {
    const response = await fetch('bombas.json');
    if (!response.ok) throw new Error(`Erro ao carregar bombas.json: ${response.statusText}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro no carregamento do JSON:', error);
    mostrarMensagem(`Erro ao carregar os dados das bombas: ${error.message}. Verifique o arquivo bombas.json.`, 'error');
    return [];
  }
}

function mostrarMensagem(texto, tipo) {
  const mensagemDiv = document.getElementById('mensagem');
  mensagemDiv.textContent = texto;
  mensagemDiv.className = `mt-4 p-4 rounded-md ${tipo === 'success' ? 'success' : 'error'}`;
  mensagemDiv.classList.remove('hidden');
  setTimeout(() => mensagemDiv.classList.add('hidden'), 5000);
}

let chartInstance = null;
function criarGrafico(vazaoM3h, mca, bombas, bombaRecomendada) {
  const ctx = document.getElementById('curvas-bombas').getContext('2d');
  if (chartInstance) {
    chartInstance.destroy();
  }

  if (!bombas || bombas.length === 0) {
    mostrarMensagem('Nenhum dado de bomba disponível para o gráfico.', 'error');
    return;
  }

  // Depuração: Verificar dados das bombas
  console.log('Dados das bombas:', bombas);

  const chartConfig = {
    type: 'line',
    data: {
      datasets: [
        ...bombas.map((bomba, index) => ({
          label: `${bomba.modelo} (${bomba.potencia})`,
          data: bomba.dados.map(d => ({ x: d.vazao || 0, y: d.altura || 0 })),
          borderColor: ['#1d4dd8', '#3b82f6', '#93c5fd', '#dbeafe', '#a3bffa'][index % 5],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          borderWidth: bomba.modelo === bombaRecomendada?.modelo ? 4 : 2,
          pointRadius: 2,
          pointHoverRadius: 5
        })),
        {
          label: 'Ponto de Operação',
          data: [{ x: vazaoM3h || 0, y: mca || 0 }],
          backgroundColor: '#a3bffa',
          borderColor: '#a3bffa',
          pointRadius: 8,
          pointHoverRadius: 10,
          showLine: false
        },
        {
          label: 'Linha de Interseção (Vazão)',
          data: [{ x: vazaoM3h || 0, y: 0 }, { x: vazaoM3h || 0, y: mca || 0 }],
          borderColor: '#6c757d',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          showLine: true
        },
        {
          label: 'Linha de Interseção (MCA)',
          data: [{ x: 0, y: mca || 0 }, { x: vazaoM3h || 0, y: mca || 0 }],
          borderColor: '#6c757d',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          showLine: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Vazão (m³/h)', color: '#1d4dd8', font: { size: 14 } },
          min: 0,
          max: Math.max(...bombas.flatMap(b => b.dados.map(d => d.vazao || 0)), vazaoM3h || 0) + 2 || 12,
          ticks: { stepSize: 1, color: '#1d4dd8' }
        },
        y: {
          title: { display: true, text: 'Altura (m)', color: '#1d4dd8', font: { size: 14 } },
          min: 0,
          max: Math.max(...bombas.flatMap(b => b.dados.map(d => d.altura || 0)), mca || 0) + 50 || 250,
          ticks: { stepSize: 50, color: '#1d4dd8' }
        }
      },
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 12 }, color: '#1d4dd8' } },
        tooltip: { enabled: true }
      }
    }
  };

  try {
    chartInstance = new Chart(ctx, chartConfig);
  } catch (error) {
    console.error('Erro ao criar o gráfico:', error);
    mostrarMensagem('Erro ao renderizar o gráfico. Verifique os dados.', 'error');
  }
}

function interpolarAltura(dados, vazaoDesejada) {
  const sortedDados = dados.sort((a, b) => a.vazao - b.vazao);
  if (vazaoDesejada <= sortedDados[0].vazao) return sortedDados[0].altura;
  if (vazaoDesejada >= sortedDados[sortedDados.length - 1].vazao) return sortedDados[sortedDados.length - 1].altura;

  for (let i = 0; i < sortedDados.length - 1; i++) {
    if (vazaoDesejada >= sortedDados[i].vazao && vazaoDesejada <= sortedDados[i + 1].vazao) {
      const x0 = sortedDados[i].vazao;
      const y0 = sortedDados[i].altura;
      const x1 = sortedDados[i + 1].vazao;
      const y1 = sortedDados[i + 1].altura;
      return y0 + (y1 - y0) * (vazaoDesejada - x0) / (x1 - x0);
    }
  }
  return 0;
}

function selecionarBomba(vazaoM3h, mca, bombas) {
  const bombasCompativeis = [];
  for (const bomba of bombas) {
    const altura = interpolarAltura(bomba.dados, vazaoM3h);
    if (altura >= mca) {
      bombasCompativeis.push({ modelo: bomba.modelo, potencia: bomba.potencia, altura: altura });
    }
  }

  bombasCompativeis.sort((a, b) => parseFloat(a.potencia) - parseFloat(b.potencia));

  return {
    bombaRecomendada: bombasCompativeis[0] || null,
    bombasCompativeis: bombasCompativeis,
    bombasDescartadas: bombas.filter(bomba => !bombasCompativeis.some(c => c.modelo === bomba.modelo))
  };
}

function atualizarTabelaBombas(bombasCompativeis, bombasDescartadas, vazaoM3h, mca) {
  const tabela = document.getElementById('tabela-bombas');
  tabela.innerHTML = '';

  bombasCompativeis.forEach(bomba => {
    const row = document.createElement('tr');
    row.className = bomba === bombasCompativeis[0] ? 'bg-green-100' : '';
    row.innerHTML = `
      <td class="border p-3">${bomba.modelo}</td>
      <td class="border p-3">${bomba.potencia}</td>
      <td class="border p-3">${bomba.altura.toFixed(2)}</td>
      <td class="border p-3"><i class="fas fa-check text-green-700 mr-2"></i>${bomba === bombasCompativeis[0] ? 'Recomendada' : 'Compatível'}</td>
    `;
    tabela.appendChild(row);
  });

  bombasDescartadas.forEach(bomba => {
    const altura = interpolarAltura(bomba.dados, vazaoM3h);
    const row = document.createElement('tr');
    row.className = 'bg-red-100';
    row.innerHTML = `
      <td class="border p-3">${bomba.modelo}</td>
      <td class="border p-3">${bomba.potencia}</td>
      <td class="border p-3">${altura.toFixed(2)}</td>
      <td class="border p-3"><i class="fas fa-times text-red-600 mr-2"></i>Descartada</td>
    `;
    tabela.appendChild(row);
  });
}

async function inicializar() {
  const bombas = await carregarBombas();
  if (bombas.length === 0) return;

  const vazaoInput = document.getElementById('vazao');
  const unidadeVazaoSelect = document.getElementById('unidade-vazao');
  const hspContainer = document.getElementById('hsp-container');
  const form = document.getElementById('dimensionamento-form');
  const limparBtn = document.getElementById('limpar-form');

  function atualizarPlaceholder() {
    vazaoInput.placeholder = unidadeVazaoSelect.value === 'm3_hora' ? 'Metros Cúbicos por Hora' : (unidadeVazaoSelect.value === 'l_dia' ? 'Litros por Dia' : 'Litros por Hora');
  }

  atualizarPlaceholder();

  unidadeVazaoSelect.addEventListener('change', function() {
    atualizarPlaceholder();
    hspContainer.classList.toggle('hidden', this.value !== 'l_dia');
    document.getElementById('hsp').toggleAttribute('required', this.value === 'l_dia');
  });

  limparBtn.addEventListener('click', function() {
    form.reset();
    atualizarPlaceholder();
    hspContainer.classList.add('hidden');
    document.getElementById('hsp').removeAttribute('required');
    document.getElementById('vazao-m3h').innerHTML = `<i class="fas fa-tint text-blue-700 mr-2"></i>Vazão Calculada: <span class="font-semibold">0.00</span> m³/h`;
    document.getElementById('mca').innerHTML = `<i class="fas fa-ruler-vertical text-blue-700 mr-2"></i>Altura Manométrica Total (MCA): <span class="font-semibold">0.00</span> m`;
    document.getElementById('bomba-recomendada').innerHTML = `<i class="fas fa-pump-soap text-blue-700 mr-2"></i>Modelo de Bomba Recomendado: <span class="font-semibold">Nenhum modelo encontrado</span>`;
    document.getElementById('tabela-bombas').innerHTML = '';
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    mostrarMensagem('Formulário limpo com sucesso!', 'success');
  });

  form.addEventListener('submit', function(event) {
    event.preventDefault();

    const h1 = parseFloat(document.getElementById('h1').value);
    const h2 = parseFloat(document.getElementById('h2').value);
    const distancia = parseFloat(document.getElementById('distancia').value);
    let vazao = parseFloat(document.getElementById('vazao').value);
    const unidadeVazao = document.getElementById('unidade-vazao').value;
    const hsp = parseFloat(document.getElementById('hsp').value) || 0;
    const kPerdas = parseFloat(document.getElementById('k_perdas').value);

    if ([h1, h2, distancia, vazao, kPerdas].some(isNaN)) {
      mostrarMensagem('Preencha todos os campos com valores válidos.', 'error');
      return;
    }
    if (unidadeVazao === 'l_dia' && hsp <= 0) {
      mostrarMensagem('Insira um valor válido para Horas de Sol Pleno.', 'error');
      return;
    }
    if ([h1, h2, distancia, vazao, kPerdas].some(v => v < 0)) {
      mostrarMensagem('Valores não podem ser negativos.', 'error');
      return;
    }
    if (kPerdas > 1) {
      mostrarMensagem('Coeficiente de perdas deve estar entre 0 e 1.', 'error');
      return;
    }

    let vazaoM3h = unidadeVazao === 'l_dia' ? (vazao / hsp) / 1000 : (unidadeVazao === 'l_hora' ? vazao / 1000 : vazao);
    const mca = h1 + h2 + (h1 + h2 + distancia) * kPerdas;

    const { bombaRecomendada, bombasCompativeis, bombasDescartadas } = selecionarBomba(vazaoM3h, mca, bombas);

    document.getElementById('vazao-m3h').innerHTML = `<i class="fas fa-tint text-blue-700 mr-2"></i>Vazão Calculada: <span class="font-semibold">${vazaoM3h.toFixed(2)}</span> m³/h`;
    document.getElementById('mca').innerHTML = `<i class="fas fa-ruler-vertical text-blue-700 mr-2"></i>Altura Manométrica Total (MCA): <span class="font-semibold">${mca.toFixed(2)}</span> m`;
    document.getElementById('bomba-recomendada').innerHTML = `<i class="fas fa-pump-soap text-blue-700 mr-2"></i>Modelo de Bomba Recomendado: <span class="font-semibold">${bombaRecomendada ? `${bombaRecomendada.modelo}, ${bombaRecomendada.potencia}` : 'Nenhum modelo encontrado'}</span>`;

    atualizarTabelaBombas(bombasCompativeis, bombasDescartadas, vazaoM3h, mca);
    criarGrafico(vazaoM3h, mca, bombas, bombaRecomendada);

    mostrarMensagem('Cálculo realizado com sucesso!', 'success');
  });
}

inicializar();
