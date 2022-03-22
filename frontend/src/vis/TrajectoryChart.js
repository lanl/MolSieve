import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import {
  React, useEffect, useState, useRef,
} from 'react';
import * as d3 from 'd3';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Checkbox from '@mui/material/Checkbox';
import SingleStateModal from '../modals/SingleStateModal';
import MultiplePathSelectionModal from '../modals/MultiplePathSelectionModal';
import SelectionModal from '../modals/SelectionModal';
import { intToRGB } from '../api/myutils';

const PATH_SELECTION = 'path_selection';
const MULTIPLE_PATH_SELECTION = 'multiple_path_selection';
const SINGLE_STATE = 'single_state';

const margin = {
  top: 20, bottom: 20, left: 40, right: 25,
};

let z_brush = null;
let s_brush = null;
let m_s_brush = null;

function TrajectoryChart({ trajectories, runs, loadingCallback }) {
  const [currentModal, setCurrentModal] = useState();

  const toggleModal = (key) => {
    if (currentModal) {
      setCurrentModal();
      return;
    }
    setCurrentModal(key);
  };

  const [contextMenu, setContextMenu] = useState(null);

  const openContext = (event) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
          mouseX: event.clientX - 2,
          mouseY: event.clientY - 4,
        }
        : null,
    );
  };

  const closeContext = () => {
    setContextMenu(null);
  };

  const [extents, setExtents] = useState([]);
  const [actionCompleted, setActionCompleted] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [currentState, setCurrentState] = useState(null);

  const [stateHighlight, setStateHighlight] = useState(false);

  const toggleStateHighlight = () => {
    setStateHighlight((prev) => !prev);
  };

  const divRef = useRef();
  const [width, setWidth] = useState();
  const [height, setHeight] = useState();

  const resize = () => {
    const newWidth = divRef.current.parentElement.clientWidth;
    setWidth(newWidth);

    const newHeight = divRef.current.parentElement.clientHeight;
    setHeight(newHeight);
  };

  useEffect(() => {
    resize();
  }, [trajectories]);

  useEffect(() => {
    window.addEventListener('resize', resize());
  }, []);

  const zoom = () => {
    if (z_brush != null) {
      if (!d3.selectAll('.brush').empty()) {
        d3.selectAll('.brush').remove();
      }

      d3.select('#svg_main')
        .append('g')
        .attr('class', 'brush')
        .call(z_brush);
    }
  };

  const selection_brush = () => {
    if (s_brush != null) {
      if (!d3.selectAll('.brush').empty()) {
        d3.selectAll('.brush').remove();
      }

      d3.select('#svg_main')
        .append('g')
        .attr('class', 'brush')
        .call(s_brush);
    }
  };

  useKeyDown('z', zoom);
  useKeyDown('Control', selection_brush);

  const multiple_selection_brush = () => {
    if (m_s_brush != null) {
      d3.select('#svg_main')
        .append('g')
        .attr('class', 'brush')
        .call(m_s_brush);
    }
  };

  const complete_multiple_selection = () => {
    if (!d3.selectAll('.brush').empty()) {
      d3.selectAll('.brush').remove();
    }

    setModalTitle('Multiple Path Selection');
    setActionCompleted(MULTIPLE_PATH_SELECTION);
  };

  useKeyDown('Shift', multiple_selection_brush);
  useKeyUp('Shift', complete_multiple_selection);

  useEffect(() => {
    switch (actionCompleted) {
      case MULTIPLE_PATH_SELECTION:
        if (extents.length < 2) break;
        toggleModal(actionCompleted);
        break;
      case PATH_SELECTION:
        toggleModal(actionCompleted);
        break;
      case SINGLE_STATE:
        console.log(actionCompleted);
        toggleModal(actionCompleted);
        break;
      default:
        break;
    }
  }, [actionCompleted]);

  const ref = useTrajectoryChartRender(
    (svg) => {
      if (height === undefined || width === undefined) {
        return;
      }
      // clear so we don't draw over-top and cause insane lag
      if (!svg.empty()) {
        svg.selectAll('*').remove();
      }

      const dataList = [];
      let count = 0;
      let maxLength = -Number.MAX_SAFE_INTEGER;

      for (const name of Object.keys(trajectories)) {
        const data = trajectories[name].sequence;

        if (data.length > maxLength) {
          maxLength = data.length;
        }

        dataList.push({
          name,
          data,
          y: count,
          fuzzy_memberships:
                        trajectories[name].fuzzy_memberships[
                          trajectories[name].current_clustering
                        ],
          unique_states: trajectories[name].unique_states,
          clusterings: trajectories[name].clusterings,
          current_clustering: trajectories[name].current_clustering,
        });
        count++;
      }

      const scale_x = d3
        .scaleLinear()
        .range([margin.left, width - margin.right])
        .domain([0, maxLength]);
      const scale_y = d3
        .scaleLinear()
        .range([margin.top, height - margin.bottom])
        .domain([0, dataList.length]);

      const tickNames = [];

      // TODO add modal on state click, to show additional information if interested

      for (const t of dataList) {
        const g = svg.append('g').attr('id', `g_${t.name}`);
        tickNames.push(t.name);
        g.selectAll('rect')
          .data(t.data, (d) => d)
          .enter()
          .append('rect')
          .attr('x', (d) => scale_x(d.timestep))
          .attr('y', () => scale_y(t.y))
          .attr('width', 1)
          .attr('height', 25)
          .attr('fill', (d) => {
            if (d.cluster === -1) {
              return 'black';
            }
            return intToRGB(d.cluster);
          })
          .attr('run', () => t.name)
          .attr('number', (d) => d.number)
          .attr('timestep', (d) => d.timestep)
          .attr('occurrences', (d) => d.occurrences)
          .attr('fuzzy_membership', (d) => t.fuzzy_memberships[d.number])
          .on('click', (_, d) => {
            setCurrentState(d);
            setActionCompleted(SINGLE_STATE);
            // toggleModal(SINGLE_STATE);
          })
          .on('mouseover', function (_, d) {
            const props = trajectories[t.name].properties;
            let propertyString = '';
            const perLine = 3;
            let count = 0;
            for (const property of props) {
              propertyString
                                += `<b>${
                  property
                }</b>: ${
                  trajectories[t.name].sequence[d.timestep][
                    property
                  ]
                } `;
              count++;
              if (count % perLine === 0) {
                propertyString += '<br>';
              }
            }
            tippy(this, {
              allowHTML: true,
              content:
                                `<b>Run</b>: ${
                                  t.name
                                }<br><b>Cluster</b>: ${
                                  d.cluster
                                } <b>Fuzzy memberships</b>: ${
                                  this.getAttribute(
                                    'fuzzy_membership',
                                  ).toString()
                                }<br>${
                                  propertyString}`,
              arrow: true,
              maxWidth: 'none',
            });

            // TODO make this bind as an effect instead of inside the function
            if (stateHighlight) {
              d3.selectAll('rect').filter((dp) => dp.id != d.id).attr('opacity', '0.05');
            }
          })
          .on('mouseout', (_, d) => {
            if (stateHighlight) {
              d3.selectAll('rect').filter((dp) => dp.id != d.id).attr('opacity', '1.0');
            }
          });

        if (Object.keys(runs[t.name].filters).length > 0) {
          for (const k of Object.keys(runs[t.name].filters)) {
            const filter = runs[t.name].filters[k];
            if (filter.enabled) {
              filter.func(t, svg, filter.options);
            }
          }
        }
      }
      const xAxis = svg.append('g').call(d3.axisBottom().scale(scale_x));

      // reset zoom
      svg.on('dblclick', () => {
        // zoom out on double click
        scale_x.domain([0, maxLength]);
        xAxis.call(d3.axisBottom(scale_x));
        svg.selectAll('rect').attr('x', (d) => scale_x(d.timestep));
      });

      z_brush = d3
        .brushX()
        .keyModifiers(false)
        .extent([
          [0, 0],
          [width, height],
        ])
        .on('end', function (e) {
          const extent = e.selection;
          if (extent) {
            svg.select('.brush').call(z_brush.move, null);
            scale_x.domain([
              scale_x.invert(extent[0]),
              scale_x.invert(extent[1]),
            ]);
            xAxis.call(d3.axisBottom(scale_x));
            svg.selectAll('rect').attr('x', (d) => scale_x(d.timestep));
            svg.selectAll('rect').attr('stroke', 'none');
          }
          d3.select(this).remove();
          d3.select('.brush').remove();
        });

      // multiple path selection
      m_s_brush = d3
        .brush()
        .keyModifiers(false)
        .extent([
          [0, 0],
          [width, height],
        ])
        .on('end', (e) => {
          const extent = e.selection;

          if (extent) {
            const curr_name = dataList[Math.round(scale_y.invert(extent[0][1]))]
              .name;
            if (curr_name !== null && curr_name !== undefined) {
              const begin = trajectories[curr_name].sequence[
                Math.round(scale_x.invert(extent[0][0]))
              ];
              const end = trajectories[curr_name].sequence[
                Math.round(scale_x.invert(extent[1][0]))
              ];
              const xtent = {
                name: curr_name,
                begin,
                end,
              };

              setExtents((prev) => [...prev, xtent]);
            }
          }
        });

      // single path selection
      s_brush = d3
        .brush()
        .keyModifiers(false)
        .extent([
          [0, 0],
          [width, height],
        ])
        .on('end', function (e) {
          const extent = e.selection;
          if (extent) {
            const curr_name = dataList[Math.round(scale_y.invert(extent[0][1]))]
              .name;
            if (curr_name !== null && curr_name !== undefined) {
              const begin = trajectories[curr_name].sequence[
                Math.round(scale_x.invert(extent[0][0]))
              ];
              const end = trajectories[curr_name].sequence[
                Math.round(scale_x.invert(extent[1][0]))
              ];
              const xtent = {
                name: curr_name,
                begin,
                end,
              };
              setModalTitle(
                `Timesteps ${begin.timestep} - ${end.timestep}`,
              );
              setExtents([...extents, xtent]);
              setActionCompleted(PATH_SELECTION);
            }
          }
          d3.select(this).remove();
          d3.select('.brush').remove();
        });
      loadingCallback();
    },
    [runs, width, height, stateHighlight, trajectories],
  );

  return (
    <div onContextMenu={openContext} ref={divRef} width="100%" height="100%">
      {width
             && height
             && Object.keys(trajectories).length
             === Object.keys(runs).length && (
             <svg
               id="svg_main"
               ref={ref}
               viewBox={[0, 0, width, height]}
             />
      )}
      <Menu
        open={contextMenu !== null}
        onClose={closeContext}
        anchorReference="anchorPosition"
        anchorPosition={
                     contextMenu !== null
                       ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                       : undefined
                }
      >
        <MenuItem>
          <ListItemIcon>
            <Checkbox
              onChange={() => { toggleStateHighlight(); }}
              checked={stateHighlight}
            />
          </ListItemIcon>
          <ListItemText>Toggle state highlighting</ListItemText>
        </MenuItem>
      </Menu>
      {currentModal === SINGLE_STATE && (
        <SingleStateModal
          open={currentModal === SINGLE_STATE}
          state={currentState}
          closeFunc={() => {
            setCurrentState(null);
            setActionCompleted('');
            toggleModal(SINGLE_STATE);
          }}
        />
      )}
      {currentModal === PATH_SELECTION && (
        <SelectionModal
          title={modalTitle}
          open={currentModal === PATH_SELECTION}
          trajectories={trajectories}
          extents={extents}
          closeFunc={() => {
            setExtents([]);
            setActionCompleted('');
            toggleModal(PATH_SELECTION);
          }}
        />
      )}
      {currentModal === MULTIPLE_PATH_SELECTION && (
        <MultiplePathSelectionModal
          title={modalTitle}
          open={currentModal === MULTIPLE_PATH_SELECTION}
          trajectories={trajectories}
          extents={extents}
          closeFunc={() => {
            setExtents([]);
            setActionCompleted('');
            toggleModal(MULTIPLE_PATH_SELECTION);
          }}
        />
      )}
    </div>
  );
}

function useKeyUp(key, action) {
  useEffect(() => {
    function onKeyup(e) {
      if (e.key === key) action();
    }
    window.addEventListener('keyup', onKeyup);
    return () => window.removeEventListener('keyup', onKeyup);
  }, []);
}

function useKeyDown(key, action) {
  useEffect(() => {
    function onKeydown(e) {
      if (!e.repeat) {
        if (e.key === key) action();
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, []);
}

export default TrajectoryChart;
