function goalChart(config) {

    var data = config.data;

    var treeData;
    data.forEach(element => {
        if (element.parentId == null) {
            treeData = new Array();
            makeTree(treeData, element.id)
        }
    });

    var region = getDataBoundary(treeData);
    var date_boundary = []; // x-axis boundary
    date_boundary[0] = moment(region[0]).startOf('month').toDate();
    date_boundary[1] = moment(region[1]).endOf('month').toDate();

    var ELEMENT = d3.select(config.element);
    var treeHeight = treeData.length * 120;

    var tick_Height = 40;
    var header_Gap = 10; // gap between header and chart
    var margin = { top: 20, right: 50, bottom: 20, left: 50 };
    var total_Width = ELEMENT[0][0].offsetWidth;
    var chart_Width = d3.max([total_Width, 400]) - margin.left - margin.right;
    var total_Height = ELEMENT[0][0].offsetHeight - 10;
    var chart_Height = d3.max([total_Height, 400]) - margin.top - tick_Height - margin.bottom;

    var svg = ELEMENT
        .append('div')
        .append("svg")
        .attr("width", total_Width)
        .attr("height", total_Height)

    var xScale = d3.time.scale()
        .domain(date_boundary)
        .range([0, chart_Width])

    var yScale = d3.scale.linear()
        .domain([1, treeData.length])
        .range([0, treeHeight]);

    var zoom = d3.behavior.zoom()
        .on("zoom", update)
        .scaleExtent([0.1, 40])
        .x(xScale)
        // .y(yScale)

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("top")
        .ticks(5)
        .tickSize(chart_Height + header_Gap)
        .tickFormat(formatXaxis)

    window.addEventListener("wheel", update, { passive: true });

    draw();

    function makeTree(parent, parentId = null) {
        data.forEach(element => {
            if (element.parentId == parentId) {
                parent.push(element)
                makeTree(parent, element.id)
            }
        });
    }

    function getDataBoundary(treeData) {
        let startAt = treeData[0].startAt,
            endAt = treeData[0].endAt;

        treeData.forEach((treeItem, idx) => {
            if (treeItem.startAt < startAt) startAt = treeItem.startAt;
            if (treeItem.endAt > endAt) endAt = treeItem.endAt;
        });

        return [startAt, endAt];
    }

    function formatXaxis(date) {
        var formatDay = d3.time.format("%a %d"),
            formatWeek = d3.time.format("%b %d"),
            formatMonth = function(d) {
                let milli = (d.getTime() - 10000);
                let vanilli = new Date(milli);
                let mon = vanilli.getMonth();
                let yr = vanilli.getFullYear();

                // return appropriate quarter for that month
                if ((mon + 1) % 3 == 0) {
                    return yr + " Q" + parseInt(mon / 3 + 1);
                } else {
                    return d3.time.format("%Y %b")(d);
                }
            },
            formatYear = d3.time.format("%Y");

        return (d3.time.month(date) < date ? (d3.time.week(date) < date ? formatDay : formatWeek) :
            d3.time.year(date) < date ? formatMonth : formatYear)(date);
    }

    function draw() {
        let g = svg.append('g')
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

        let h = chart_Height + tick_Height + header_Gap;
        g.append("rect")
            .attr("width", chart_Width)
            .attr("height", h)
            .attr('class', "chart-Block")

        g.append("rect")
            .attr("class", "zoom box")
            .attr("width", chart_Width)
            .attr("height", h)
            .style("visibility", "hidden")
            .attr("pointer-events", "all")
            .call(zoom)

        g.append("g")
            .attr("id", "clipTick")
            .append("rect")
            .attr("width", chart_Width)
            .attr("height", tick_Height + header_Gap)
            .attr('class', "tick-Block")

        g.append("g")
            .attr("transform", "translate(0," + h + ")")
            .attr("class", "axis")
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "start")

        g.append("clipPath")
            .attr("id", "clipChart")
            .append("rect")
            .attr("y", tick_Height + header_Gap * 2)
            .attr("width", chart_Width)
            .attr("height", chart_Height - header_Gap * 2);

        g.append("g")
            .attr("class", "chart")
            .attr("clip-path", "url(#clipChart)");

        update();
    }

    function update() {
        if (zoom_update()) {
            drawTree();
        }

        function drawTree() {
            var chart = svg.select("g.chart");
            chart.html("");

            var Blocks = chart.selectAll(".chart")
                .data(treeData)
                .enter()
                .append("g")
                .attr('class', 'Single--Block')
                .attr("transform", function(d, i) {
                    // return "translate(" + (margin.left) + ", " + (margin.top + tick_Height + header_Gap) + ")";
                    return "translate(" + xScale(new Date(d.startAt)) + margin.left + "," + (margin.top + tick_Height + header_Gap) + ")";
                })
                .call(appendBar)
                .call(appendConnector)

            Blocks
                .append('g')
                .attr('transform', function(d) {
                    if (startsBefore(d) && isVisible(d)) {
                        var position = Math.abs(xScale(new Date(d.startAt)));
                        return "translate(" + position + ", 0)";
                    } else {
                        return "translate(0, 0)";
                    }
                })
                .call(appendTitle)
                .call(appendBody)
                .call(appendFooter)

            Blocks
                .each(function(d, i) {
                    trimTitle(getWidth(d), this, config.box_padding * 2)
                })

            function appendBar(d, i) {
                this.append('rect')
                    .attr('class', 'node-Block')
                    .attr('fill', 'auto')
                    .attr('rx', 5)
                    .attr('ry', 5)
                    .attr("x", 0)
                    .attr("y", function(d, i) {
                        return yScale(i + 1);
                    })
                    .attr("width", function(d) {
                        return (getActualWidth(d) + 10);
                    })
                    .attr("height", 87)
                    .style("cursor", "move")
            }

            function appendTitle(d, i) {
                this.append('text')
                    .attr('class', 'node-Title')
                    .attr("x", config.box_padding)
                    .attr("y", function(d, i) {
                        return (yScale(i + 1) + 20)
                    })
                    .text(function(d) {
                        return d.title
                    })
            }

            function appendBody(d, i) {
                this.append('g')
                    .attr("transform", function(d, i) {
                        var position = config.box_padding;
                        if (position < 10) {
                            position = 0;
                        }
                        return "translate(" + position + ", " + (yScale(i + 1) + 45) + ")";
                    })
                    .call(renderDuration)
                    .call(appendProgressBar)
            }

            function appendFooter(d, i) {
                this.append('g')
                    .attr("transform", function(d, i) {
                        var position = config.box_padding;
                        if (position < 10) {
                            position = 0;
                        }
                        return "translate(" + position + ", " + (yScale(i + 1) + 80) + ")";
                    })
                    .call(renderPro)
            }

            function appendProgressBar(d, i) {
                this.append('rect')
                    .attr('class', 'ProgressBar')
                    .attr('fill', '#ddd')
                    .attr('width', function(d) {
                        return getActualWidth(d) - 20;
                    })

                this.append('rect')
                    .attr('class', 'ProgressBar')
                    .attr('fill', '#4975D4')
                    .attr('width', function(d) {
                        return (d.progress * (getActualWidth(d) - 20)) / 100;
                    })

                this.selectAll('.ProgressBar')
                    .attr('rx', 5)
                    .attr('ry', 5)
                    .attr('y', 10)
                    .attr('height', 7)
                    .attr('x', 10)
                    .attr('opacity', function(d) {
                        return getActualWidth(d);
                    })
            }

            function renderPro(d, i) {
                this.append('text')
                    .attr('class', 'node-ProNum')
                    .text(function(d) {
                        var proText = d.progress + "%"
                        return proText
                    })
                    .attr('opacity', function(d) {
                        return Number(getWidth(d) > 80)
                    })
            }

            function renderDuration(d, i) {
                this.append('text')
                    .attr('class', 'node-Duration')
                    .attr('x', 10)
                    .text(function(d) {
                        return "Due" + " " + moment(d.endAt).format("MMM DD,YYYY");
                    })
                    .attr('opacity', function(d) {
                        return Number(getWidth(d) > 200)
                    })
            }

            function trimTitle(node_width, node, padding) {
                var textBlock = d3.select(node).select('.node-Title')
                var textLength = textBlock.node().getComputedTextLength(),
                    text = textBlock.text()
                while (textLength > (node_width - padding) && text.length > 0) {
                    text = text.slice(0, -1);
                    textBlock.text(text + '...');
                    textLength = textBlock.node().getComputedTextLength();
                }
            }

            function isVisible(node) {
                var startAt_visible = moment(node.startAt, "MM/DD/YYYY").isBetween(date_boundary[0], date_boundary[1], 'days'),
                    endAt_visible = moment(node.endAt, "MM/DD/YYYY").isBetween(date_boundary[0], date_boundary[1], 'days');

                return startAt_visible || endAt_visible;

            }

            function appendConnector(d) {
                var diagonal = d3.svg.diagonal()
                    .source(function(d) {
                        p = getParent(d);
                        if (p == null) { return { x: -1000, y: -1000 }; }
                        return {
                            x: 0,
                            y: yScale(getPos_Y(d)) + 43
                        };
                    })
                    .target(function(d) {
                        p = getParent(d);
                        if (p == null) { return { x: -1000, y: -1000 }; }
                        return {
                            x: getActualWidth(p) + (xScale(new Date(p.startAt)) - xScale(new Date(d.startAt))) + 10,
                            y: yScale(getPos_Y(p)) + 43
                        };
                    })
                    .projection(function(d, i) {
                        let x = d.x;
                        let y = d.y;
                        if (i == 1) { x -= 250, y -= 90; }
                        if (i == 2) { x += 250, y += 90; }

                        return [x, y];
                    });

                this.append('path')
                    .attr('d', diagonal)
                    .attr('class', 'Connector')
            }

            function getParent(d) {
                let parent = null
                treeData.forEach((e, i) => {
                    if (e.id == d.parentId) {
                        parent = e;
                    }
                });

                return parent;
            }

            function getPos_Y(d) {
                let y = 0;
                treeData.forEach((e, i) => {
                    if (e.id == d.id) {
                        y = i + 1;
                    }
                });

                return y;
            }

            function startsBefore(node) {
                return moment(node.startAt, "MM/DD/YYYY").isBefore(date_boundary[0])
            }

            function endsAfter(node) {
                return moment(node.endAt, "MM/DD/YYYY").isAfter(date_boundary[1]);
            }

            function getWidth(node) {
                let nodeWidth = 0;
                if (endsAfter(node)) {
                    nodeWidth = Math.abs(xScale(new Date(date_boundary[1])) - xScale(new Date(node.startAt)));
                } else if (startsBefore(node)) {
                    nodeWidth = Math.abs(xScale(new Date(date_boundary[0])) - xScale(new Date(node.endAt)));
                } else {
                    nodeWidth = getActualWidth(node);
                }
                return nodeWidth;
            }

            function getActualWidth(node) {
                return Math.abs(xScale(new Date(node.endAt)) - xScale(new Date(node.startAt)));
            }
        }

        function zoom_update() {
            let e = d3.event;
            if (e != null) {
                // panning y-axia
                if (e.sourceEvent.type === "mousemove") {
                    if (e.translate[1] > 0) e.translate[1] = 0;
                    if (e.translate[1] < chart_Height - treeHeight) e.translate[1] = chart_Height - treeHeight;

                    zoom.translate(e.translate);
                    yScale.range([e.translate[1], e.translate[1] / e.scale + treeHeight]);
                    // svg.select("g.chart")
                    //     .transition()
                    //     .duration(500)
                    //     .ease('quad-out')
                    //     .attr('transform', 'translate(' + e.translate + ')');
                }
            }

            svg.select("g.axis").call(xAxis);
            return true;
        }

    }

}