// Carregar dados das bombas
async function carregarBombas() {
  try {
    const response = await fetch('bombas.json');
    if (!response.ok) throw new Error('Erro ao carregar bombas.json');
    return await response.json();
  } catch (error) {
    console.error(error);
    mostrarMensagem('Erro ao carregar os dados das bombas. Verifique o arquivo bombas.json.', 'error');
    return [];
  }
}

// Mostrar mensagem de sucesso ou erro
function mostrarMensagem(texto, tipo) {
  const mensagemDiv = document.getElementById('mensagem');
  mensagemDiv.textContent = texto;
  mensagemDiv.className = `mt-4 p-4 rounded-md ${tipo === 'success' ? 'success' : 'error'}`;
  mensagemDiv.classList.remove('hidden');
  setTimeout(() => mensagemDiv.classList.add('hidden'), 5000);
}

// Configuração do gráfico
let chartInstance = null;
function criarGrafico(vazaoM3h, mca, bombas, bombaRecomendada) {
  const ctx = document.getElementById('curvas-bombas').getContext('2d');
  if (chartInstance) {
    chartInstance.destroy();
  }

  const chartConfig = {
    type: 'line',
    data: {
      datasets: [
        ...bombas.map((bomba, index) => ({
          label: `${bomba.modelo} (${bomba.potencia})`,
          data: bomba.dados.map(d => ({ x: d.vazao, y: d.altura })),
          borderColor: [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
          ][index],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          borderWidth: bomba.modelo === bombaRecomendada?.modelo ? 4 : 2,
          opacity: bomba.modelo === bombaRecomendada?.modelo ? 1 : 0.5
        })),
        {
          label: 'Ponto de Operação',
          data: [{ x: vazaoM3h, y: mca }],
          backgroundColor: '#EF4444',
          borderColor: '#EF4444',
          pointRadius: 8,
          pointHoverRadius: 10,
          showLine: false
        },
        {
          label: 'Linha de Interseção (Vazão)',
          data: [{ x: vazaoM3h, y: 0 }, { x: vazaoM3h, y: mca }],
          borderColor: '#1F2937',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          showLine: true
        },
        {
          label: 'Linha de Interseção (MCA)',
          data: [{ x: 0, y: mca }, { x: vazaoM3h, y: mca }],
          borderColor: '#1F2937',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          showLine: true
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Vazão (m³/h)', font: { size: 14 } },
          min: 0,
          max: 12,
          ticks: { stepSize: 1 }
        },
        y: {
          title: { display: true, text: 'Altura (m)', font: { size: 14 } },
          min: 0,
          max: 250,
          ticks: { stepSize: 50 }
        }
      },
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 12 } } },
        tooltip: { enabled: true }
      }
    }
  };

  chartInstance = new Chart(ctx, chartConfig);
}

// Função para interpolar altura com base na vazão
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

// Função para selecionar bomba adequada
function selecionarBomba(vazaoM3h, mca, bombas) {
  const bombasCompativeis = [];
  for (const bomba of bombas) {
    const altura = interpolarAltura(bomba.dados, vazaoM3h);
    if (altura >= mca) {
      bombasCompativeis.push({
        modelo: bomba.modelo,
        potencia: bomba.potencia,
        altura: altura
      });
    }
  }

  // Ordenar por potência (menor para maior)
  bombasCompativeis.sort((a, b) => {
    const potenciaA = parseFloat(a.potencia);
    const potenciaB = parseFloat(b.potencia);
    return potenciaA - potenciaB;
  });

  return {
    bombaRecomendada: bombasCompativeis[0] || null,
    bombasCompativeis: bombasCompativeis,
    bombasDescartadas: bombas.filter(bomba => !bombasCompativeis.some(c => c.modelo === bomba.modelo))
  };
}

// Atualizar tabela de bombas
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
      <td class="border p-3"><i class="fas fa-check text-green-500 mr-2"></i>${bomba === bombasCompativeis[0] ? 'Recomendada (Menor Potência)' : 'Compatível'}</td>
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
      <td class="border p-3"><i class="fas fa-times text-red-500 mr-2"></i>Descartada (Altura Insuficiente)</td>
    `;
    tabela.appendChild(row);
  });
}

// Inicializar o formulário
async function inicializar() {
  const bombas = await carregarBombas();
  if (bombas.length === 0) return;

  const vazaoInput = document.getElementById('vazao');
  const unidadeVazaoSelect = document.getElementById('unidade-vazao');
  const hspContainer = document.getElementById('hsp-container');
  const form = document.getElementById('dimensionamento-form');
  const limparBtn = document.getElementById('limpar-form');

  function atualizarPlaceholder() {
    const unidade = unidadeVazaoSelect.value;
    if (unidade === 'm3_hora') {
      vazaoInput.placeholder = 'Metros Cúbicos por Hora';
    } else if (unidade === 'l_dia') {
      vazaoInput.placeholder = 'Litros por Dia';
    } else if (unidade === 'l_hora') {
      vazaoInput.placeholder = 'Litros por Hora';
    }
  }

  atualizarPlaceholder();

  unidadeVazaoSelect.addEventListener('change', function() {
    atualizarPlaceholder();
    if (this.value === 'l_dia') {
      hspContainer.classList.remove('hidden');
      document.getElementById('hsp').setAttribute('required', 'true');
    } else {
      hspContainer.classList.add('hidden');
      document.getElementById('hsp').removeAttribute('required');
    }
  });

  limparBtn.addEventListener('click', function() {
    form.reset();
    atualizarPlaceholder();
    hspContainer.classList.add('hidden');
    document.getElementById('hsp').removeAttribute('required');
    document.getElementById('vazao-m3h').innerHTML = `Vazão Calculada: <span class="font-semibold">0.00</span> m³/h`;
    document.getElementById('mca').innerHTML = `Altura Manométrica Total (MCA): <span class="font-semibold">0.00</span> m`;
    document.getElementById('bomba-recomendada').innerHTML = `Modelo de Bomba Recomendado: <span class="font-semibold">Nenhum modelo encontrado</span>`;
    document.getElementById('tabela-bombas').innerHTML = '';
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    mostrarMensagem('Formulário limpo com sucesso!', 'success');
  });

  form.addEventListener('submit', function(event) {
    event.preventDefault();

    // Capturar entradas
    const h1 = parseFloat(document.getElementById('h1').value);
    const h2 = parseFloat(document.getElementById('h2').value);
    const distancia = parseFloat(document.getElementById('distancia').value);
    let vazao = parseFloat(document.getElementById('vazao').value);
    const unidadeVazao = document.getElementById('unidade-vazao').value;
    const hsp = parseFloat(document.getElementById('hsp').value) || 0;
    const kPerdas = parseFloat(document.getElementById('k_perdas').value);

    // Validar entradas
    if (isNaN(h1) || isNaN(h2) || isNaN(distancia) || isNaN(vazao) || isNaN(kPerdas)) {
      mostrarMensagem('Por favor, preencha todos os campos com valores numéricos válidos.', 'error');
      return;
    }
    if (unidadeVazao === 'l_dia' && hsp <= 0) {
      mostrarMensagem('Por favor, insira um valor válido para Horas de Sol Pleno (h).', 'error');
      return;
    }
    if (h1 < 0 || h2 < 0 || distancia < 0 || vazao < 0 || kPerdas < 0) {
      mostrarMensagem('Os valores não podem ser negativos.', 'error');
      return;
    }
    if (kPerdas > 1) {
      mostrarMensagem('O coeficiente de perdas deve estar entre 0 e 1.', 'error');
      return;
    }

    // Converter vazão para m³/h
    let vazaoM3h;
    if (unidadeVazao === 'l_dia') {
      vazaoM3h = (vazao / hsp) / 1000;
    } else if (unidadeVazao === 'l_hora') {
      vazaoM3h = vazao / 1000;
    } else {
      vazaoM3h = vazao;
    }

    // Calcular MCA
    const distanciaTotal = h1 + h2 + distancia;
    const mca = h1 + h2 + distanciaTotal * kPerdas;

    // Selecionar bomba
    const { bombaRecomendada, bombasCompativeis, bombasDescartadas } = selecionarBomba(vazaoM3h, mca, bombas);

    // Exibir resultados
    document.getElementById('vazao-m3h').innerHTML = `<i class="fas fa-tint text-blue-500 mr-2"></i>Vazão Calculada: <span class="font-semibold">${vazaoM3h.toFixed(2)}</span> m³/h`;
    document.getElementById('mca').innerHTML = `<i class="fas fa-ruler-vertical text-blue-500 mr-2"></i>Altura Manométrica Total (MCA): <span class="font-semibold">${mca.toFixed(2)}</span> m`;
    document.getElementById('bomba-recomendada').innerHTML = `<i class="fas fa-pump-soap text-blue-500 mr-2"></i>Modelo de Bomba Recomendado: <span class="font-semibold">${bombaRecomendada ? `${bombaRecomendada.modelo}, ${bombaRecomendada.potencia}` : 'Nenhum modelo encontrado'}</span>`;

    // Atualizar tabela de bombas
    atualizarTabelaBombas(bombasCompativeis, bombasDescartadas, vazaoM3h, mca);

    // Criar gráfico
    criarGrafico(vazaoM3h, mca, bombas, bombaRecomendada);

    mostrarMensagem('Cálculo realizado com sucesso!', 'success');
  });
}

// Iniciar a aplicação
inicializar();
